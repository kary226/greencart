import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'

// Input Field Component modernisé
const InputField = ({ type, placeholder, name, handleChange, address }) => (
    <input
        className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm'
        type={type}
        placeholder={placeholder}
        onChange={handleChange}
        name={name}
        value={address[name] || ''}
        required
    />
)

// Select Field Component avec recherche modernisé
const SelectField = ({ name, placeholder, options, value, handleChange, loading }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const selectedOption = options.find(opt => opt._id === value)

    return (
        <div className="relative">
            <div
                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-gray-700 cursor-pointer flex justify-between items-center text-sm focus-within:border-red-500"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedOption ? "text-gray-900" : "text-gray-400"}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {isOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-red-500 text-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    {loading ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Chargement...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Aucune option</div>
                    ) : (
                        filteredOptions.map(opt => (
                            <div
                                key={opt._id}
                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm transition"
                                onClick={() => {
                                    handleChange({ target: { name, value: opt._id } })
                                    setIsOpen(false)
                                    setSearchTerm('')
                                }}
                            >
                                {opt.name}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

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
        }
    }

    if (!user) {
        return null;
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Ajouter une adresse</h1>
                    <p className="text-sm text-gray-500 mt-1">Renseignez vos coordonnées pour la livraison</p>
                    <div className="w-16 h-0.5 bg-red-500 rounded-full mt-3"></div>
                </div>

                <div className="flex flex-col-reverse lg:flex-row justify-between gap-8">
                    {/* Formulaire */}
                    <div className="flex-1 max-w-lg">
                        <form onSubmit={onSubmitHandler} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                                    <InputField handleChange={handleChange} address={address} name='firstName' type="text" placeholder="Votre prénom" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                    <InputField handleChange={handleChange} address={address} name='lastName' type="text" placeholder="Votre nom" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                                <SelectField
                                    name="cityId"
                                    placeholder="Sélectionner une ville"
                                    options={cities}
                                    value={address.cityId}
                                    handleChange={handleChange}
                                    loading={loadingCities}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Commune</label>
                                <SelectField
                                    name="communeId"
                                    placeholder={address.cityId ? "Sélectionner une commune" : "Sélectionnez d'abord une ville"}
                                    options={communes}
                                    value={address.communeId}
                                    handleChange={handleChange}
                                    loading={loadingCommunes}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quartier / Rue</label>
                                <InputField handleChange={handleChange} address={address} name='street' type="text" placeholder="Ex: Rue 12, Quartier Central" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                <InputField handleChange={handleChange} address={address} name='phone' type="tel" placeholder="Ex: 05 01 02 03 04" />
                            </div>

                            <button className='w-full mt-6 bg-red-500 text-white py-3 rounded-xl font-medium hover:bg-red-600 transition shadow-sm'>
                                Enregistrer l'adresse
                            </button>
                        </form>
                    </div>

                    {/* Illustration */}
                    <div className="flex justify-center lg:block">
                        <img 
                            className='w-64 lg:w-80 object-contain' 
                            src={assets.add_address_iamge} 
                            alt="Add Address" 
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AddAddress