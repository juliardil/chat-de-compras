// Gestión de vendedores afiliados.
//
// El dueño se autentica con su propio token; la función verifica que sea
// propietario del comercio y usa el API key del proyecto solo para las
// operaciones de administración de usuarios y para religar la atribución tras
// un restablecimiento de contraseña. La sesión del dueño nunca se cierra.

import { createAdminClient, createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type OwnerContext = {
  admin: ReturnType<typeof createAdminClient>;
  commerceId: string;
  ownerUserId: string;
};

type Member = {
  id: string;
  commerce_id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: 'owner' | 'seller';
  is_active: boolean;
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanText = (value: unknown) => String(value ?? '').trim();

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
const apiKey = Deno.env.get('API_KEY');

const adminRequest = async (path: string, init: RequestInit = {}) => {
  if (!baseUrl || !apiKey) {
    throw new Error('La función no tiene configuradas las credenciales del servidor.');
  }
  return fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
};

const findAuthUser = async (email: string) => {
  const response = await adminRequest(
    `/api/auth/users?search=${encodeURIComponent(email)}&limit=50`
  );
  if (!response.ok) return null;
  const payload = await response.json();
  const users = Array.isArray(payload?.data) ? payload.data : [];
  return (
    users.find(
      (user: { email?: string }) =>
        String(user.email || '').toLowerCase() === email.toLowerCase()
    ) || null
  );
};

const createAuthUser = async ({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}) => {
  const response = await adminRequest('/api/auth/users?client_type=server', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, autoConfirm: true }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `No se pudo crear la cuenta de acceso del vendedor. ${detail.slice(0, 240)}`.trim()
    );
  }
  // La respuesta de creación no trae el id: se resuelve por correo.
  const created = await findAuthUser(email);
  if (!created?.id) {
    throw new Error('La cuenta se creó, pero no se pudo asociar al vendedor.');
  }
  return created as { id: string; email: string };
};

const deleteAuthUser = async (userId: string) => {
  const response = await adminRequest('/api/auth/users', {
    method: 'DELETE',
    body: JSON.stringify({ userIds: [userId] }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `No se pudo restablecer la cuenta. ${detail.slice(0, 240)}`.trim()
    );
  }
};

const authenticateOwner = async (req: Request): Promise<OwnerContext | null> => {
  const token = cleanText(req.headers.get('Authorization')).replace(/^Bearer\s+/i, '');
  if (!baseUrl || !token) return null;

  const userClient = createClient({ baseUrl, edgeFunctionToken: token });
  const { data: current, error: currentError } = await userClient.auth.getCurrentUser();
  if (currentError || !current?.user?.id) return null;

  const { data: canManage } = await userClient.database.rpc(
    'app_can_manage_commerce_members'
  );
  // El SDK devuelve el booleano directamente para RPC escalares; se aceptan
  // también las formas en arreglo por si el gateway cambia la serialización.
  const allowed =
    canManage === true ||
    (Array.isArray(canManage) &&
      (canManage[0] === true ||
        canManage[0]?.result === true ||
        canManage[0]?.app_can_manage_commerce_members === true));
  if (!allowed) return null;

  const { data: commerceRows } = await userClient.database.rpc('app_my_commerce');
  const commerceId = commerceRows?.[0]?.id;
  if (!commerceId) return null;

  return {
    admin: createAdminClient({ baseUrl, apiKey: apiKey as string }),
    commerceId,
    ownerUserId: current.user.id,
  };
};

const getMember = async (
  ctx: OwnerContext,
  memberId: string
): Promise<Member | null> => {
  const { data, error } = await ctx.admin.database
    .from('commerce_members')
    .select('*')
    .eq('id', memberId)
    .eq('commerce_id', ctx.commerceId)
    .limit(1);
  if (error) throw new Error(error.message || 'No se pudo consultar el vendedor.');
  return (data?.[0] as Member) || null;
};

const relinkAttribution = async (
  ctx: OwnerContext,
  oldUserId: string,
  newUserId: string,
  fullName: string,
  avatarUrl: string | null
) => {
  const updates = await Promise.all([
    ctx.admin.database
      .from('purchase_offers')
      .update({ created_by_user_id: newUserId })
      .eq('commerce_id', ctx.commerceId)
      .eq('created_by_user_id', oldUserId),
    ctx.admin.database
      .from('chat_threads')
      .update({
        assigned_seller_id: newUserId,
        assigned_seller_name: fullName,
        assigned_seller_avatar: avatarUrl,
      })
      .eq('commerce_id', ctx.commerceId)
      .eq('assigned_seller_id', oldUserId),
    ctx.admin.database
      .from('purchase_orders')
      .update({ sold_by_user_id: newUserId, sold_by_name: fullName })
      .eq('commerce_id', ctx.commerceId)
      .eq('sold_by_user_id', oldUserId),
  ]);
  const failed = updates.find((update) => update.error);
  if (failed?.error) {
    throw new Error(failed.error.message || 'No se pudo religar la atribución del vendedor.');
  }
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return respond({ error: 'Método no permitido.' }, 405);
  }

  try {
    const ctx = await authenticateOwner(req);
    if (!ctx) {
      return respond({ error: 'Solo el propietario del comercio puede gestionar vendedores.' }, 403);
    }

    const body = await req.json();
    const action = cleanText(body?.action);

    if (action === 'create') {
      const fullName = cleanText(body?.fullName);
      const email = cleanText(body?.email).toLowerCase();
      const password = String(body?.password ?? '');
      const avatarUrl = cleanText(body?.avatarUrl) || null;

      if (fullName.length < 2) return respond({ error: 'Indica el nombre completo del vendedor.' }, 400);
      if (!validEmail(email)) return respond({ error: 'Indica un correo válido.' }, 400);
      if (password.length < 8) {
        return respond({ error: 'La contraseña inicial debe tener al menos 8 caracteres.' }, 400);
      }
      if (await findAuthUser(email)) {
        return respond({ error: 'Ya existe una cuenta con ese correo.' }, 409);
      }

      const authUser = await createAuthUser({ email, password, name: fullName });
      const { data, error } = await ctx.admin.database
        .from('commerce_members')
        .insert([
          {
            commerce_id: ctx.commerceId,
            user_id: authUser.id,
            full_name: fullName,
            email,
            avatar_url: avatarUrl,
            role: 'seller',
            is_active: true,
          },
        ])
        .select('*');
      if (error) throw new Error(error.message || 'No se pudo guardar el vendedor.');
      return respond({ member: data?.[0] || null });
    }

    const memberId = cleanText(body?.memberId);
    if (!memberId) return respond({ error: 'No se indicó el vendedor.' }, 400);
    const member = await getMember(ctx, memberId);
    if (!member) return respond({ error: 'El vendedor ya no pertenece a tu comercio.' }, 404);
    if (member.role === 'owner') {
      return respond({ error: 'El propietario no se puede editar desde el equipo.' }, 400);
    }

    if (action === 'update') {
      const fullName = cleanText(body?.fullName);
      const avatarUrl = cleanText(body?.avatarUrl) || null;
      if (fullName.length < 2) return respond({ error: 'Indica el nombre completo del vendedor.' }, 400);

      const { data, error } = await ctx.admin.database
        .from('commerce_members')
        .update({ full_name: fullName, avatar_url: avatarUrl })
        .eq('id', member.id)
        .select('*');
      if (error) throw new Error(error.message || 'No se pudo actualizar el vendedor.');

      await Promise.all([
        ctx.admin.database
          .from('chat_threads')
          .update({ assigned_seller_name: fullName, assigned_seller_avatar: avatarUrl })
          .eq('commerce_id', ctx.commerceId)
          .eq('assigned_seller_id', member.user_id),
        ctx.admin.database
          .from('purchase_orders')
          .update({ sold_by_name: fullName })
          .eq('commerce_id', ctx.commerceId)
          .eq('sold_by_user_id', member.user_id),
      ]);

      return respond({ member: data?.[0] || null });
    }

    if (action === 'set_active') {
      const isActive = Boolean(body?.isActive);
      const { data, error } = await ctx.admin.database
        .from('commerce_members')
        .update({ is_active: isActive })
        .eq('id', member.id)
        .select('*');
      if (error) throw new Error(error.message || 'No se pudo cambiar el estado del vendedor.');
      return respond({ member: data?.[0] || null });
    }

    if (action === 'reset_password') {
      const password = String(body?.password ?? '');
      if (password.length < 8) {
        return respond({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' }, 400);
      }

      const oldUserId = member.user_id;
      await deleteAuthUser(oldUserId);
      const authUser = await createAuthUser({
        email: member.email,
        password,
        name: member.full_name,
      });
      await ctx.admin.database
        .from('commerce_members')
        .insert([
          {
            commerce_id: ctx.commerceId,
            user_id: authUser.id,
            full_name: member.full_name,
            email: member.email,
            avatar_url: member.avatar_url,
            role: 'seller',
            is_active: member.is_active,
          },
        ]);
      await relinkAttribution(
        ctx,
        oldUserId,
        authUser.id,
        member.full_name,
        member.avatar_url
      );
      return respond({ success: true });
    }

    return respond({ error: 'Acción no reconocida.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar la operación.';
    return respond({ error: message }, 400);
  }
}
