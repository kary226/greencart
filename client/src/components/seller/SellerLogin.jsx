import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast';

const SellerLogin = () => {
    const {isSeller, setIsSeller, navigate, axios} = useAppContext()
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmitHandler = async (event)=>{
        event.preventDefault();
        setLoading(true);
        
        try {
            const {data} = await axios.post('/api/seller/login', {email, password})
            if(data.success){
                // STOCKER LE TOKEN ADMIN DANS LOCALSTORAGE
                localStorage.setItem('sellerToken', data.token);
                // AJOUTER LE TOKEN DANS LE HEADER AXIOS
                axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
                setIsSeller(true);
                toast.success("Connexion admin réussie");
                navigate('/seller');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(()=>{
        // Vérifier si un token admin existe déjà
        const sellerToken = localStorage.getItem('sellerToken');
        if (sellerToken) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${sellerToken}`;
            setIsSeller(true);
            navigate("/seller");
        }
    }, [isSeller, navigate, setIsSeller, axios]);

    return !isSeller && (
        <form onSubmit={onSubmitHandler} className='min-h-screen flex items-center text-sm text-gray-600'>
            <div className='flex flex-col gap-5 m-auto items-start p-8 py-12 min-w-80 sm:min-w-88 rounded-lg shadow-xl border border-gray-200'>
                <p className='text-2xl font-medium m-auto'><span className="text-primary">Seller</span> Login</p>
                <div className="w-full ">
                    <p>Email</p>
                    <input onChange={(e)=>setEmail(e.target.value)} value={email}
                     type="email" placeholder="enter your email" 
                    className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" required/>
                </div>
                <div className="w-full ">
                    <p>Password</p>
                    <input onChange={(e)=>setPassword(e.target.value)} value={password}
                     type="password" placeholder="enter your password"
                    className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" required/>
                </div>
                <button disabled={loading} className="bg-primary text-white w-full py-2 rounded-md cursor-pointer disabled:opacity-50">
                    {loading ? "Connexion..." : "Login"}
                </button>
            </div>
        </form>
    )
}

export default SellerLogin;