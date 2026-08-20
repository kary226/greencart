import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import { ArrowLeft, User, MapPin, Home, Phone, Truck, Wallet, PhoneCall } from 'lucide-react'
// Selecteur partage et accessible (etait duplique ici et dans Account).
import SelectSearch from '../components/SelectSearch'

const InputField = ({ type, placeholder, name, handleChange, address, id, inputMode, icon: Icon }) => (
    <div className="relative">
        {Icon && (
            <Icon aria-hidden="true" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        )}
        <input
            id={id}
            className={`rs-input ${Icon ? 'rs-input--icon-l' : ''}`}
            type={type}
            inputMode={inputMode}
            placeholder={placeholder}
            onChange={handleChange}
            name={name}
            value={address[name] || ''}
            required
        />
    </div>
)

const Reassurance = ({ icon: Icon, children }) => (
    <li className="flex items-center gap-3 text-[13px] text-ink-600">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-ink-0 text-ramses-600 shrink-0">
            {Icon && <Icon size={15} />}
        </span>
        {children}
    </li>
)


const AddAddress = () => {

    const { axios, user, navigate, setShowUserLogin, fetchUser } = useAppContext();

    const [address, setAddress] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        street: '',
        cityId: '',
        communeId: '',
        phone: user?.phone || '',
    })

    const [cities, setCities] = useState([])
    const [communes, setCommunes] = useState([])
    const [loadingCities, setLoadingCities] = useState(true)
    const [loadingCommunes, setLoadingCommunes] = useState(false)
    const [enregistrement, setEnregistrement] = useState(false)

    useEffect(() => {
        if (user) {
            setAddress(prev => ({
                ...prev,
                firstName: user.firstName || prev.firstName,
                lastName: user.lastName || prev.lastName,
                phone: user.phone || prev.phone,
            }))
        }
    }, [user])

    useEffect(() => {
        if (!user) {
            toast.error('Veuillez vous connecter pour ajouter une adresse')
            setShowUserLogin(true)
            navigate('/')
        }
    }, [user, navigate, setShowUserLogin])

    const fetchCities = async () => {
        try {
            const { data } = await axios.get('/api/location/cities')
            if (data.success) {
                setCities(data.cities)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingCities(false)
        }
    }

    const fetchCommunes = async (cityId) => {
        if (!cityId) {
            setCommunes([])
            return
        }
        setLoadingCommunes(true)
        try {
            const { data } = await axios.get(`/api/location/communes/${cityId}`)
            if (data.success) {
                setCommunes(data.communes)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingCommunes(false)
        }
    }

    useEffect(() => {
        fetchCities()
    }, [])

    useEffect(() => {
        if (address.cityId) {
            fetchCommunes(address.cityId)
        } else {
            setCommunes([])
        }
    }, [address.cityId])

    const handleChange = (e) => {
        const { name, value } = e.target;
        setAddress((prevAddress) => ({
            ...prevAddress,
            [name]: value,
            // Changer de ville invalide la commune choisie : sans ça, on
            // pouvait soumettre une commune qui n'appartient pas à la ville.
            ...(name === 'cityId' && value !== prevAddress.cityId ? { communeId: '' } : {}),
        }))
    }

    const onSubmitHandler = async (e) => {
        e.preventDefault();

        if (!address.cityId) {
            toast.error('Veuillez sélectionner une ville')
            return
        }
        if (!address.communeId) {
            toast.error('Veuillez sélectionner une commune')
            return
        }

        setEnregistrement(true)
        try {
            const userUpdateData = {};

            if (address.firstName !== user.firstName) {
                userUpdateData.firstName = address.firstName;
            }
            if (address.lastName !== user.lastName) {
                userUpdateData.lastName = address.lastName;
            }
            if (address.phone !== user.phone) {
                userUpdateData.phone = address.phone;
            }

            if (Object.keys(userUpdateData).length > 0) {
                await axios.post('/api/user/update', {
                    userId: user._id,
                    ...userUpdateData
                });
                await fetchUser();
            }

            const { data } = await axios.post('/api/address/add', { address });

            if (data.success) {
                toast.success('Adresse ajoutée et profil mis à jour');
                navigate('/cart?refresh=true');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setEnregistrement(false)
        }
    }

    if (!user) {
        return null;
    }

    const Champ = ({ htmlFor, children }) => (
        <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-ink-500 mb-1.5">
            {children}
        </label>
    )

    const Groupe = ({ eyebrow, children }) => (
        <div>
            <p className="rs-label text-ink-400 mb-3">{eyebrow}</p>
            <div className="grid gap-4">{children}</div>
        </div>
    )

    return (
        <div className="rs-sunken min-h-screen">
            <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">

                <div className="flex items-center gap-2 mb-6">
                    <button
                        onClick={() => navigate('/cart')}
                        className="rs-icon-btn"
                        aria-label="Retour au panier"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="rs-h1">Adresse de livraison</h1>
                        <p className="text-[13px] text-ink-400 mt-0.5">
                            Tous les champs sont nécessaires pour livrer votre commande.
                        </p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">

                    <form onSubmit={onSubmitHandler} className="rs-raised rounded-2xl p-5 md:p-7 grid gap-7">

                        <Groupe eyebrow="Destinataire">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Champ htmlFor="firstName">Prénom</Champ>
                                    <InputField id="firstName" icon={User} handleChange={handleChange} address={address} name="firstName" type="text" placeholder="Votre prénom" />
                                </div>
                                <div>
                                    <Champ htmlFor="lastName">Nom</Champ>
                                    <InputField id="lastName" icon={User} handleChange={handleChange} address={address} name="lastName" type="text" placeholder="Votre nom" />
                                </div>
                            </div>
                        </Groupe>

                        <Groupe eyebrow="Adresse">
                            <div>
                                <Champ htmlFor="cityId">Ville</Champ>
                                <SelectSearch
                                    id="cityId"
                                    name="cityId"
                                    icon={MapPin}
                                    placeholder="Sélectionner une ville"
                                    options={cities}
                                    value={address.cityId}
                                    handleChange={handleChange}
                                    loading={loadingCities}
                                />
                            </div>

                            <div>
                                <Champ htmlFor="communeId">Commune</Champ>
                                <SelectSearch
                                    id="communeId"
                                    name="communeId"
                                    icon={MapPin}
                                    placeholder={address.cityId ? 'Sélectionner une commune' : "Choisissez d'abord une ville"}
                                    options={communes}
                                    value={address.communeId}
                                    handleChange={handleChange}
                                    loading={loadingCommunes}
                                />
                            </div>

                            <div>
                                <Champ htmlFor="street">Quartier / Rue</Champ>
                                <InputField id="street" icon={Home} handleChange={handleChange} address={address} name="street" type="text" placeholder="Ex : Rue 12, Quartier Central" />
                            </div>
                        </Groupe>

                        <Groupe eyebrow="Contact">
                            <div>
                                <Champ htmlFor="phone">Téléphone</Champ>
                                <InputField id="phone" icon={Phone} handleChange={handleChange} address={address} name="phone" type="tel" inputMode="tel" placeholder="Ex : 05 01 02 03 04" />
                                <p className="text-[11.5px] text-ink-400 mt-1.5">
                                    Le livreur vous appellera sur ce numéro.
                                </p>
                            </div>
                        </Groupe>

                        <button type="submit" disabled={enregistrement} className="rs-btn rs-btn--primary rs-btn--block">
                            {enregistrement ? 'Enregistrement…' : "Enregistrer l'adresse"}
                        </button>
                    </form>

                    <aside className="rs-card bg-ramses-50 border-ramses-100 rounded-2xl overflow-hidden">
                        <img
                            className="w-full max-w-[180px] mx-auto object-contain pt-2"
                            src={assets.add_address_iamge}
                            alt=""
                            loading="lazy"
                        />
                        <ul className="grid gap-3 mt-5">
                            <Reassurance icon={Truck}>Livraison rapide, partout à Abidjan</Reassurance>
                            <Reassurance icon={Wallet}>Paiement à la livraison possible</Reassurance>
                            <Reassurance icon={PhoneCall}>Le livreur vous appelle avant de passer</Reassurance>
                        </ul>
                    </aside>
                </div>
            </div>
        </div>
    )
}

export default AddAddress