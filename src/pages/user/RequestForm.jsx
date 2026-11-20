
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { DataNotice } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { createPurchaseRequest, fetchBuyerProfileId } from '../../data/appData';
import { fetchMyWorkshop, WORKSHOP_SPECIALTIES } from '../../data/workshop';
import {
  findSpecialtyMatches,
  suggestServiceSpecialty,
} from '../../data/serviceSpecialties';
import { SERVICE_MODALITIES } from '../../data/serviceModalities';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Car,
  ChevronDown,
  ClipboardList,
  MapPin,
  Plus,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';

// Actualización Junio 2026 - Formulario Exclusivo Automotriz

const AUTOMOTIVE_FORM_FIELDS = [
  { name: 'category', label: 'Tipo de repuesto/accesorio', type: 'select', options: [
    'Motor', 'Frenos', 'Suspensión', 'Eléctrico',
    'Llantas y Neumáticos', 'Interior / Exterior',
    'Lubricantes y Fluidos', 'Taller Mecánico',
    'Accesorios Vehiculares', 'Audio y Sonido', 'Seguridad Vehicular'
  ]},
  { name: 'item', label: 'Producto específico', placeholder: 'Ej: Pastillas de freno, filtro de aceite, batería', type: 'text' },
  { name: 'vehicleType', label: 'Tipo de vehículo', type: 'select', options: ['Auto', 'Moto', 'Camioneta', 'Camión', 'Tractor', 'Otro'] },
  { name: 'vehicleBrand', label: 'Marca del vehículo', placeholder: 'Ej: Toyota, Ford, Honda', type: 'text' },
  { name: 'vehicleModel', label: 'Modelo del vehículo', placeholder: 'Ej: Corolla, Fiesta, Civic', type: 'text' },
  { name: 'yearFrom', label: 'Año inicial', type: 'number', placeholder: 'Ej: 2015' },
  { name: 'yearTo', label: 'Año final', type: 'number', placeholder: 'Ej: 2024' },
  { name: 'reference', label: 'Referencia o número de parte', placeholder: 'Ej: 04465-02060', type: 'text' },
  { name: 'brand', label: 'Marca del repuesto (opcional)', placeholder: 'Ej: Bosch, Monroe, Fram', type: 'text' },
  { name: 'condition', label: 'Condición', type: 'select', options: ['Nuevo', 'Usado', 'Indistinto'] },
  { name: 'quantity', label: 'Cantidad', type: 'number', placeholder: 'Ej: 1', defaultValue: '1', min: 1, step: 1 },
  { name: 'notes', label: 'Notas adicionales', type: 'textarea', placeholder: 'Detalles específicos, color, ubicación, etc.' }
];

// Campos mínimos para poder enviar una solicitud.
const REQUIRED_FIELDS = ['category', 'item', 'vehicleType'];

// Sugerencias suaves: solo rellenan el producto y el comprador puede editarlo.
const QUICK_SUGGESTIONS = [
  'Pastillas de freno',
  'Filtro de aceite',
  'Batería',
  'Amortiguadores',
  'Aceite 5W-30',
  'Bujías',
];

// Un solo año para simplificar el formulario. Se guarda en yearFrom y yearTo
// para conservar la compatibilidad con mapRequestItem y los paneles actuales.
const VEHICLE_YEARS = Array.from(
  { length: 46 },
  (_, index) => String(new Date().getFullYear() + 1 - index)
);

const PRINCIPAL_FIELD_NAMES = [
  'category',
  'item',
  'vehicleType',
  'vehicleBrand',
  'vehicleModel',
];
const ADVANCED_FIELD_NAMES = ['reference', 'brand', 'condition', 'notes'];

const normalizeQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

// Las fotos se guardan dentro del mismo JSONB `items` que ya usa la solicitud.
// Se reducen en el navegador para no enviar archivos originales de varios MB.
const MAX_IMAGE_SIDE = 900;
const IMAGE_QUALITY = 0.65;

const compressImage = (file) =>
  new Promise((resolve) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => resolve(null);
      image.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext('2d');
          if (!context) {
            resolve(null);
            return;
          }

          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
        } catch {
          resolve(null);
        }
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });

export default function RequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Fases 3/4: modo servicio, placa/zona y credencial B2B del comprador.
  const [serviceMode, setServiceMode] = useState(Boolean(location.state?.serviceMode));
  const [serviceFault, setServiceFault] = useState(location.state?.serviceFault || '');
  const [serviceZone, setServiceZone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [isVerifiedWorkshop, setIsVerifiedWorkshop] = useState(false);

  // La especialidad se sugiere desde la descripción, pero el selector siempre
  // queda visible y una elección manual nunca se sobrescribe automáticamente.
  const [serviceSpecialty, setServiceSpecialty] = useState(
    () => suggestServiceSpecialty(location.state?.serviceFault || '') || ''
  );
  const [specialtyManuallySet, setSpecialtyManuallySet] = useState(false);
  const [serviceModality, setServiceModality] = useState('');
  const [submitError, setSubmitError] = useState(null);

  const handleServiceFaultChange = (event) => {
    const description = event.target.value;
    setServiceFault(description);
    if (specialtyManuallySet) return;
    setServiceSpecialty(suggestServiceSpecialty(description) || '');
  };

  const specialtyMatches = findSpecialtyMatches(serviceFault);
  const isAmbiguousSpecialty = specialtyMatches.length > 1;

  useEffect(() => {
    let active = true;
    fetchMyWorkshop()
      .then((result) => {
        if (!active) return;
        const workshop = result.items?.[0];
        setIsVerifiedWorkshop(Boolean(workshop?.is_verified));
      })
      .catch(() => {
        // La insignia es informativa: un fallo no bloquea la solicitud.
      });
    return () => {
      active = false;
    };
  }, []);

  const [products, setProducts] = useState([
    { 
      id: 1, 
      category: location.state?.system || '', 
      item: '', 
      vehicleType: '', 
      vehicleBrand: '', 
      vehicleModel: '', 
      yearFrom: '', 
      yearTo: '', 
      reference: '', 
      brand: '', 
      condition: '', 
      quantity: '1', 
      notes: '', 
      installation: '',
      images: [] 
    }
  ]);

  // Errores por producto y campo: { [productId]: { [field]: mensaje } }
  const [errors, setErrors] = useState({});

  // El acordeón nace cerrado para no alargar el formulario; los campos siguen
  // viajando en `items` aunque el comprador nunca lo abra.
  const [advancedOpen, setAdvancedOpen] = useState({});

  const addProduct = () => {
    setProducts([...products, { 
      id: Date.now(), 
      category: '', 
      item: '', 
      vehicleType: '', 
      vehicleBrand: '', 
      vehicleModel: '', 
      yearFrom: '', 
      yearTo: '', 
      reference: '', 
      brand: '', 
      condition: '', 
      quantity: '1', 
      notes: '', 
      installation: '',
      images: [] 
    }]);
  };

  const removeProduct = (id) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));

    setErrors((prev) => {
      const fieldsToClear = field === 'yearFrom' || field === 'yearTo'
        ? ['yearFrom', 'yearTo']
        : [field];

      if (!fieldsToClear.some((name) => prev[id]?.[name])) return prev;

      const productErrors = { ...prev[id] };
      fieldsToClear.forEach((name) => delete productErrors[name]);

      const next = { ...prev };
      if (Object.keys(productErrors).length > 0) next[id] = productErrors;
      else delete next[id];
      return next;
    });
  };

  // El año único escribe yearFrom y yearTo: el resto de la app sigue leyendo
  // el mismo contrato de siempre.
  const updateVehicleYear = (id, value) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, yearFrom: value, yearTo: value } : product
      )
    );

    setErrors((prev) => {
      if (!prev[id]?.yearFrom && !prev[id]?.yearTo) return prev;
      const productErrors = { ...prev[id] };
      delete productErrors.yearFrom;
      delete productErrors.yearTo;
      const next = { ...prev };
      if (Object.keys(productErrors).length > 0) next[id] = productErrors;
      else delete next[id];
      return next;
    });
  };

  const toggleAdvanced = (id) =>
    setAdvancedOpen((current) => ({ ...current, [id]: !current[id] }));

  const handleImageUpload = async (id, e) => {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de quitarlo.
    e.target.value = '';
    if (!file) return;

    const dataUrl = await compressImage(file);
    if (!dataUrl) return;

    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, images: [...product.images, dataUrl] } : product
      )
    );
  };

  const removeImage = (prodId, imgIndex) => {
    setProducts(products.map(p => 
      p.id === prodId ? { ...p, images: p.images.filter((_, i) => i !== imgIndex) } : p
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Regla obligatoria del trabajo de servicio: sin especialidad no se publica
    // y no se llama al backend, para no enviar una solicitud que ningún taller
    // podría recibir por especialidad.
    if (serviceMode && (!serviceSpecialty || !serviceModality)) {
      const missingSpecialty = !serviceSpecialty;
      setSubmitError(
        missingSpecialty
          ? 'Debes elegir la especialidad requerida para dirigir el trabajo a los talleres que la prestan.'
          : 'Debes elegir la modalidad de atención: Servicio a domicilio o Visita al taller.'
      );
      document
        .getElementById(missingSpecialty ? 'service-specialty' : 'service-modality')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitError(null);

    // En modo servicio no se valida el bloque de producto: no se renderiza.
    if (!serviceMode) {
      const nextErrors = {};

      products.forEach((product) => {
        const productErrors = {};

        REQUIRED_FIELDS.forEach((field) => {
          if (!String(product[field] || '').trim()) {
            productErrors[field] = 'Este campo es obligatorio.';
          }
        });

        if (product.yearFrom && product.yearTo && Number(product.yearFrom) > Number(product.yearTo)) {
          productErrors.yearTo = 'El año final no puede ser menor al año inicial.';
        }

        if (
          product.quantity !== '' &&
          (!Number.isFinite(Number(product.quantity)) || Number(product.quantity) < 1)
        ) {
          productErrors.quantity = 'La cantidad debe ser al menos 1.';
        }

        if (Object.keys(productErrors).length > 0) {
          nextErrors[product.id] = productErrors;
        }
      });

      setErrors(nextErrors);

      const firstInvalidId = Object.keys(nextErrors)[0];
      if (firstInvalidId) {
        document
          .getElementById(`product-${firstInvalidId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setSubmitting(true);

    // Se intenta publicar de verdad. Las imágenes de referencia ya están
    // comprimidas como data URL y viajan dentro de `items`.
    // buyer_id referencia buyer_profiles.id, así que primero se resuelve el
    // perfil real de la sesión (nunca se inventa un identificador).
    const buyer = await fetchBuyerProfileId(user?.id);
    if (!buyer.item) {
      setSubmitting(false);
      navigate('/responses', {
        state: {
          products,
          publishError:
            buyer.error ||
            buyer.notice ||
            'Tu cuenta todavía no tiene un perfil de comprador en el backend.',
        },
      });
      return;
    }

    // Se conserva la cantidad real (no se fuerza a 1) y las fotos de
    // referencia comprimidas; ambos datos viajan dentro de `items`, que es la
    // columna JSONB existente. No se crean tablas ni buckets nuevos.
    const items = products.map(({ images, ...rest }) => ({
      ...rest,
      quantity: normalizeQuantity(rest.quantity),
      images: Array.isArray(images) ? images.filter(Boolean) : [],
    }));

    // La segmentación también se expone en columnas principales para que el
    // comercio pueda filtrar sin abrir el JSONB de `items`. Se conserva dentro
    // de `items` por compatibilidad con los paneles ya existentes.
    const primaryProduct = products[0] || {};
    const category = String(primaryProduct.category ?? '').trim();
    const vehicleType = String(primaryProduct.vehicleType ?? '').trim();

    const requestPayload = {
      buyer_id: buyer.item.id,
      title: serviceMode
        ? `Instalación / reparación: ${serviceSpecialty || 'servicio'}`
        : products[0]?.item || 'Solicitud de compra',
      description: serviceMode
        ? serviceFault.trim() || serviceSpecialty
        : products[0]?.notes || products[0]?.item || '',
      category: category || null,
      vehicle_type: vehicleType || null,
      items,
      currency: 'MXN',
      status: 'open',
    };

    // Solo se envían los campos nuevos cuando el comprador los usó. Las
    // solicitudes de repuestos tradicionales conservan su payload exacto.
    if (serviceMode) {
      requestPayload.request_type = 'service';
      // La columna nueva viaja a app_available_service_jobs(): solo los
      // talleres con esta especialidad verán el trabajo en /workshop-jobs.
      requestPayload.specialty = serviceSpecialty;
      requestPayload.service_modality = serviceModality;
      if (serviceZone.trim()) requestPayload.service_zone = serviceZone.trim();
    }
    if (serviceMode || isVerifiedWorkshop) {
      if (vehiclePlate.trim()) requestPayload.vehicle_plate = vehiclePlate.trim().toUpperCase();
    }

    const result = await createPurchaseRequest(requestPayload);

    setSubmitting(false);

    // Confirmación solo cuando la publicación terminó correctamente. Si falló,
    // se conserva el tratamiento actual: /responses muestra el motivo real.
    if (result.ok) {
      navigate('/request-success', {
        replace: true,
        state: {
          requestId: result.data?.[0]?.id || null,
          products,
        },
      });
      return;
    }

    navigate('/responses', {
      state: {
        products,
        requestId: null,
        publishError: result.error,
      },
    });
  };

  // Render compartido para no duplicar estilos entre los campos principales y
  // los del acordeón. Las sugerencias solo acompañan al producto específico.
  const renderField = (product, field) => (
    <div key={field.name}>
      {field.type === 'select' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-800">{field.label}</label>
          <div className="relative">
            <select
              value={product[field.name]}
              onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
              className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] appearance-none cursor-pointer"
            >
              <option value="">Selecciona una opción</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      ) : field.type === 'textarea' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-800">{field.label}</label>
          <textarea
            className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] transition-all placeholder:text-gray-600 min-h-[80px]"
            placeholder={field.placeholder}
            value={product[field.name]}
            onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
          />
        </div>
      ) : (
        <Input
          label={field.label}
          placeholder={field.placeholder}
          type={field.type}
          min={field.min}
          step={field.step}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          value={product[field.name]}
          onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
        />
      )}

      {field.name === 'item' ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => updateProduct(product.id, 'item', suggestion)}
              aria-pressed={product.item === suggestion}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                product.item === suggestion
                  ? 'bg-[#00EED0]/20 text-[#4B227A] border-[#00EED0]/40'
                  : 'bg-white/70 text-gray-700 border-white/40 hover:bg-white'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {errors[product.id]?.[field.name] && (
        <p className="text-xs text-red-700 mt-1">{errors[product.id][field.name]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#E7E7E7] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10 border-b border-white/30">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-[#006E7A]" />
            Solicitud Automotriz
          </h1>
          <p className="text-xs text-gray-600">Describe tu repuesto o accesorio</p>
        </div>
      </header>

      <div className="px-4 pt-4">
        <DataNotice>
          La solicitud se guarda en InsForge y queda vinculada a tu perfil de
          comprador. Si el envío falla, verás el motivo en la pantalla de
          respuestas; no se muestra una confirmación falsa.
        </DataNotice>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
        {!serviceMode ? (
          <button
            type="button"
            onClick={() => setServiceMode(true)}
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[#0197AF]/30 bg-[#0197AF]/10 px-4 py-3 text-left transition hover:bg-[#0197AF]/15"
          >
            <span className="flex items-center gap-3">
              <Wrench className="w-5 h-5 shrink-0 text-[#006E7A]" />
              <span>
                <span className="block text-sm font-bold text-gray-800">
                  ¿Quién me lo instala / repara?
                </span>
                <span className="block text-xs text-gray-600">
                  Publica un trabajo para talleres verificados
                </span>
              </span>
            </span>
            <ChevronDown className="w-4 h-4 -rotate-90 shrink-0 text-[#006E7A]" />
          </button>
        ) : null}

        {isVerifiedWorkshop ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-2">
            <BadgeCheck className="w-4 h-4 shrink-0 mt-0.5 text-green-700" />
            <p className="text-xs font-semibold text-green-800">
              Taller Verificado • Prioridad B2B
              <span className="block font-normal text-green-700">
                Tu solicitud mostrará tu credencial a las repuesteras. Puedes indicar la placa
                para controlar tu historial.
              </span>
            </p>
          </div>
        ) : null}

        {serviceMode ? (
          <section className="rounded-2xl bg-white/80 backdrop-blur-md p-5 shadow-sm border border-[#00EED0]/30 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#006E7A]" />
                <div>
                  <h3 className="font-bold text-gray-800">Solicitud de servicio</h3>
                  <p className="text-xs text-gray-600">
                    Describe la falla o el repuesto que quieres instalar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setServiceMode(false)}
                className="text-xs font-semibold text-[#4B227A] hover:underline"
              >
                Volver a repuestos
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-800">
                Descripción de la falla o repuesto a instalar
              </span>
              <textarea
                className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 min-h-[90px]"
                placeholder="Ej: El vehículo hace ruido al frenar; requiero cambiar pastillas y rectificar discos"
                value={serviceFault}
                onChange={handleServiceFaultChange}
              />
            </label>

            <label className="flex flex-col gap-1.5" htmlFor="service-specialty">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800">
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-[#006E7A]" /> Especialidad requerida
                  <span className="text-red-600">*</span>
                </span>
                {serviceSpecialty && !specialtyManuallySet ? (
                  <span className="rounded-full border border-[#00EED0]/40 bg-[#00EED0]/20 px-2 py-0.5 text-[10px] font-bold text-[#4B227A]">
                    Sugerida automáticamente
                  </span>
                ) : null}
              </span>
              <div className="relative">
                <select
                  id="service-specialty"
                  aria-label="Especialidad requerida"
                  value={serviceSpecialty}
                  onChange={(event) => {
                    setServiceSpecialty(event.target.value);
                    setSpecialtyManuallySet(true);
                    setSubmitError(null);
                  }}
                  className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] appearance-none cursor-pointer"
                >
                  <option value="">Selecciona una especialidad</option>
                  {WORKSHOP_SPECIALTIES.map((specialty) => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {isAmbiguousSpecialty ? (
                <p className="text-xs text-[#006E7A]">
                  Detectamos varias especialidades posibles. Elige la correcta para dirigir el trabajo.
                </p>
              ) : null}
              {!serviceSpecialty && !isAmbiguousSpecialty ? (
                <p className="text-xs text-gray-600">
                  Elige la especialidad para dirigir el trabajo a los talleres que la prestan.
                </p>
              ) : null}
              {submitError && !serviceSpecialty ? (
                <p role="alert" className="text-xs text-red-700">{submitError}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5" htmlFor="service-modality">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                <MapPin className="w-3.5 h-3.5 text-[#006E7A]" /> Modalidad de atención
                <span className="text-red-600">*</span>
              </span>
              <div className="relative">
                <select
                  id="service-modality"
                  aria-label="Modalidad de atención"
                  value={serviceModality}
                  onChange={(event) => {
                    setServiceModality(event.target.value);
                    setSubmitError(null);
                  }}
                  className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] appearance-none cursor-pointer"
                >
                  <option value="">Selecciona una modalidad</option>
                  {SERVICE_MODALITIES.map((modality) => (
                    <option key={modality} value={modality}>{modality}</option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {!serviceModality ? (
                <p className="text-xs text-gray-600">
                  Indica si acudimos a tu domicilio o si tú visitas el taller.
                </p>
              ) : null}
              {submitError && serviceSpecialty && !serviceModality ? (
                <p role="alert" className="text-xs text-red-700">{submitError}</p>
              ) : null}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                  <MapPin className="w-3.5 h-3.5 text-[#006E7A]" /> Zona / colonia
                </span>
                <input
                  className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30"
                  placeholder="Ej. Centro, Ciudad de México"
                  value={serviceZone}
                  onChange={(event) => setServiceZone(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                  <Car className="w-3.5 h-3.5 text-[#006E7A]" /> Placa del vehículo (opcional)
                </span>
                <input
                  className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 uppercase"
                  placeholder="Ej. ABC1234"
                  maxLength={15}
                  value={vehiclePlate}
                  onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                />
              </label>
            </div>

            <DataNotice>
              Los talleres verificados podrán enviarte una propuesta con precio de mano de obra,
              tiempo estimado y notas. Podrás continuar por el chat.
            </DataNotice>
          </section>
        ) : isVerifiedWorkshop ? (
          <label className="block rounded-2xl bg-white/80 backdrop-blur-md p-4 shadow-sm border border-white/30">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <Car className="w-4 h-4 text-[#006E7A]" /> Placa del vehículo (opcional)
            </span>
            <input
              className="mt-2 w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 uppercase"
              placeholder="Ej. ABC1234"
              maxLength={15}
              value={vehiclePlate}
              onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
            />
          </label>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {!serviceMode ? products.map((product, index) => (
            <div key={product.id} id={`product-${product.id}`} className="bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-white/30 relative">
              <div className="flex justify-between items-center mb-4 border-b border-white/40 pb-2">
                <h3 className="font-bold text-[#006E7A] flex items-center gap-2">
                  <span className="bg-[#00EED0]/20 text-[#4B227A] w-6 h-6 rounded-full flex items-center justify-center text-xs border border-[#00EED0]/30">
                    {index + 1}
                  </span>
                  Producto Automotriz
                </h3>
                {products.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeProduct(product.id)}
                    className="text-[#4B227A] hover:bg-[#4B227A]/10 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {AUTOMOTIVE_FORM_FIELDS
                  .filter((field) => PRINCIPAL_FIELD_NAMES.includes(field.name))
                  .map((field) => renderField(product, field))}

                {/* Año único: escribe yearFrom y yearTo para conservar el
                    contrato que ya leen los paneles del comercio. */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`year-${product.id}`}
                    className="text-sm font-medium text-gray-800"
                  >
                    Año del vehículo
                  </label>
                  <div className="relative">
                    <select
                      id={`year-${product.id}`}
                      value={product.yearFrom || ''}
                      onChange={(e) => updateVehicleYear(product.id, e.target.value)}
                      className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] appearance-none cursor-pointer"
                    >
                      <option value="">Selecciona el año</option>
                      {VEHICLE_YEARS.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {errors[product.id]?.yearTo && (
                    <p className="text-xs text-red-700">{errors[product.id].yearTo}</p>
                  )}
                </div>

                {AUTOMOTIVE_FORM_FIELDS
                  .filter((field) => field.name === 'quantity')
                  .map((field) => renderField(product, field))}

                {/* Instalación: opción suave que viaja dentro de `items`. */}
                <div className="rounded-xl border border-white/40 bg-white/60 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                      <Wrench className="w-3.5 h-3.5 text-[#006E7A]" /> ¿Incluir instalación?
                    </span>
                    <div role="group" aria-label="Instalación" className="flex shrink-0 gap-1">
                      {['Sí', 'No'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={product.installation === option}
                          onClick={() => updateProduct(product.id, 'installation', option)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                            product.installation === option
                              ? 'bg-[#00EED0]/25 text-[#4B227A] border-[#00EED0]/50'
                              : 'bg-white/70 text-gray-600 border-white/40 hover:bg-white'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">
                    Se envía con el producto para que el negocio cotice mano de obra si hace falta.
                  </p>
                </div>

                {/* Detalles avanzados y referencia: cerrados por defecto. */}
                <div className="rounded-xl border border-white/40 bg-white/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleAdvanced(product.id)}
                    aria-expanded={Boolean(advancedOpen[product.id])}
                    aria-controls={`advanced-${product.id}`}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-semibold text-[#006E7A]">
                      Detalles avanzados y referencia
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#006E7A] transition-transform ${
                        advancedOpen[product.id] ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {advancedOpen[product.id] ? (
                    <div
                      id={`advanced-${product.id}`}
                      className="space-y-4 border-t border-white/40 px-3 pb-3 pt-3"
                    >
                      {AUTOMOTIVE_FORM_FIELDS
                        .filter((field) => ADVANCED_FIELD_NAMES.includes(field.name))
                        .map((field) => renderField(product, field))}
                    </div>
                  ) : null}
                </div>

                {/* Image Upload */}
                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-sm font-medium text-gray-800">Imágenes de referencia</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    <label className="flex flex-col items-center justify-center w-20 h-20 bg-white/70 border-2 border-dashed border-[#0197AF]/30 rounded-xl cursor-pointer hover:bg-white/80 active:scale-95 transition-all flex-shrink-0">
                      <Camera className="w-5 h-5 text-[#006E7A] mb-1" />
                      <span className="text-[10px] text-gray-600">Foto</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(product.id, e)} />
                    </label>

                    {product.images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-white/30 group">
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removeImage(product.id, idx)}
                          className="absolute top-1 right-1 bg-[#4B227A]/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )) : null}

          {!serviceMode ? (
            <button
              type="button"
              onClick={addProduct}
              className="w-full py-4 border-2 border-dashed border-[#00EED0]/30 rounded-2xl flex items-center justify-center gap-2 text-[#006E7A] font-bold hover:bg-[#00EED0]/10 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Agregar otro producto
            </button>
          ) : null}
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-white/30 max-w-md mx-auto z-20">
        <Button fullWidth onClick={handleSubmit} disabled={submitting} className="shadow-lg shadow-[#00EED0]/30">
          {submitting
            ? 'ENVIANDO…'
            : serviceMode
              ? '🔧 PUBLICAR TRABAJO PARA TALLERES'
              : `👉 ENVIAR SOLICITUD AUTOMOTRIZ (${products.length})`}
        </Button>
      </div>
    </div>
  );
}
