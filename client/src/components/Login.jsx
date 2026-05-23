import React from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const Login = () => {

    const { setShowUserLogin, loginUser, registerUser } = useAppContext()

    const [state, setState] = React.useState("login");
    const [firstName, setFirstName] = React.useState("");
    const [lastName, setLastName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        setLoading(true);

        if (state === "login") {
            await loginUser(email, password);
        } else {
            if (!firstName && !lastName) {
                toast.error("Veuillez entrer votre prénom et nom");
                setLoading(false);
                return;
            }
            await registerUser(firstName, lastName, email, password);
        }

        setLoading(false);
        setShowUserLogin(false);
    }

    return (
        <div onClick={() => setShowUserLogin(false)} className='fixed top-0 bottom-0 left-0 right-0 z-30 flex items-center text-sm text-gray-600 bg-black/50'>

            <form onSubmit={onSubmitHandler} onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4 m-auto items-start p-8 py-12 w-80 sm:w-[352px] rounded-lg shadow-xl border border-gray-200 bg-white">
                <p className="text-2xl font-medium m-auto">
                    <span className="text-primary">User</span> {state === "login" ? "Login" : "Sign Up"}
                </p>
                {state === "register" && (
                    <>
                        <div className="w-full">
                            <p>Prénom</p>
                            <input onChange={(e) => setFirstName(e.target.value)} value={firstName} placeholder="Votre prénom" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="text" required />
                        </div>
                        <div className="w-full">
                            <p>Nom</p>
                            <input onChange={(e) => setLastName(e.target.value)} value={lastName} placeholder="Votre nom" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="text" required />
                        </div>
                    </>
                )}
                <div className="w-full">
                    <p>Email</p>
                    <input onChange={(e) => setEmail(e.target.value)} value={email} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="email" required />
                </div>
                <div className="w-full">
                    <p>Mot de passe</p>
                    <input onChange={(e) => setPassword(e.target.value)} value={password} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="password" required />
                </div>
                {state === "register" ? (
                    <p>
                        Already have account? <span onClick={() => setState("login")} className="text-primary cursor-pointer">click here</span>
                    </p>
                ) : (
                    <>
                        <p>
                            Create an account? <span onClick={() => setState("register")} className="text-primary cursor-pointer">click here</span>
                        </p>
                        <Link
                            to="/forgot-password"
                            onClick={() => setShowUserLogin(false)}
                            className="text-sm text-primary hover:underline mt-1 block text-center"
                        >
                            Mot de passe oublié ?
                        </Link>
                    </>
                )}
                <button disabled={loading} className="bg-primary hover:bg-primary-dull transition-all text-white w-full py-2 rounded-md cursor-pointer disabled:opacity-50">
                    {loading ? "Chargement..." : (state === "register" ? "Create Account" : "Login")}
                </button>
            </form>
        </div>
    )
}

export default Login