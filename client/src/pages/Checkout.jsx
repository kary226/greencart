import React from 'react';
import { useAppContext } from '../context/AppContext';

const Checkout = () => {
    const { user, cartItems } = useAppContext();
    
    console.log("Checkout chargé", { user, cartItems });
    
    return (
        <div className="mt-32 text-center">
            <h1 className="text-3xl font-bold">Page Checkout</h1>
            <p className="mt-4">La route fonctionne correctement.</p>
            <button 
                onClick={() => window.history.back()}
                className="mt-6 px-6 py-2 bg-black text-white rounded-full"
            >
                ← Retour
            </button>
        </div>
    );
};

export default Checkout;