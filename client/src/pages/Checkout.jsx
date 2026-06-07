import React from 'react';

const Checkout = () => {
    console.log("✅ Checkout chargé avec succès");
    
    return (
        <div className="mt-32 text-center">
            <h1 className="text-3xl font-bold">Page Checkout</h1>
            <p className="mt-4 text-gray-600">La route fonctionne correctement.</p>
            <button 
                onClick={() => window.history.back()}
                className="mt-6 px-6 py-2 bg-black text-white rounded-full"
            >
                ← Retour au panier
            </button>
        </div>
    );
};

export default Checkout;