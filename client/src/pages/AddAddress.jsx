import React, { useEffect, useRef, useState } from 'react'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
// Selecteur partage et accessible (etait duplique ici et dans Account).
import SelectSearch from '../components/SelectSearch'

const InputField = ({ type, placeholder, name, handleChange, address, id, inputMode }) => (
    <input
        id={id}
        className="rs-input"
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={handleChange}
        name={name}
        value={address[name] || ''}
        required
    />
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

    return (
        <div className="bg-ink-50 min-h-screen">
            <div className="max-w-5xl mx-auto px-4 py-8">

                <header className="mb-7">
                    <h1 className="rs-display">Adresse de livraison</h1>
                    <p className="text-[13px] text-ink-400 mt-1.5">
                        Tous les champs sont nécessaires pour livrer votre commande.
                    </p>
                </header>

                <div className="flex flex-col-reverse lg:flex-row justify-between gap-10">

                    <div className="flex-1 max-w-lg">
                        <form onSubmit={onSubmitHandler} className="grid gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Champ htmlFor="firstName">Prénom</Champ>
                                    <InputField id="firstName" handleChange={handleChange} address={address} name="firstName" type="text" placeholder="Votre prénom" />
                                </div>
                                <div>
                                    <Champ htmlFor="lastName">Nom</Champ>
                                    <InputField id="lastName" handleChange={handleChange} address={address} name="lastName" type="text" placeholder="Votre nom" />
                                </div>
                            </div>

                            <div>
                                <Champ htmlFor="cityId">Ville</Champ>
                                <SelectSearch
                                    id="cityId"
                                    name="cityId"
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
                                    placeholder={address.cityId ? 'Sélectionner une commune' : "Choisissez d'abord une ville"}
                                    options={communes}
                                    value={address.communeId}
                                    handleChange={handleChange}
                                    loading={loadingCommunes}
                                />
                            </div>

                            <div>
                                <Champ htmlFor="street">Quartier / Rue</Champ>
                                <InputField id="street" handleChange={handleChange} address={address} name="street" type="text" placeholder="Ex : Rue 12, Quartier Central" />
                            </div>

                            <div>
                                <Champ htmlFor="phone">Téléphone</Champ>
                                <InputField id="phone" handleChange={handleChange} address={address} name="phone" type="tel" inputMode="tel" placeholder="Ex : 05 01 02 03 04" />
                                <p className="text-[11.5px] text-ink-400 mt-1.5">
                                    Le livreur vous appellera sur ce numéro.
                                </p>
                            </div>

                            <button type="submit" disabled={enregistrement} className="rs-btn rs-btn--primary rs-btn--block mt-2">
                                {enregistrement ? 'Enregistrement…' : "Enregistrer l'adresse"}
                            </button>
                        </form>
                    </div>

                    <div className="flex justify-center lg:block shrink-0">
                        <img
                            className="w-56 lg:w-72 object-contain"
                            src={assets.add_address_iamge}
                            alt=""
                            loading="lazy"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AddAddress
