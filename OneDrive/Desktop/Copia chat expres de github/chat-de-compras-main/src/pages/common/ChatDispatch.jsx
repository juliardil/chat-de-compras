import React from 'react';
import { useAuth } from '../../context/AuthContext';
import BuyerChat from '../user/Chat';
import SellerChat from '../commerce/Chat';

export default function ChatDispatch() {
  const { user } = useAuth();

  if (user?.role === 'commerce') {
    return <SellerChat />;
  }

  return <BuyerChat />;
}
