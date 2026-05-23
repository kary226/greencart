import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'

// Input Field Component
const InputField = ({ type, placeholder, name, handleChange, address })=>(
    <input className='w-full px-2 py-2.5 border border-gray-500/30 rounded outline-none text-gray-500 focus:border-primary transition'
    type={type}
    placeholder={placeholder}
    onChange={handleChange}
    name={name}
    value={address[name] || ''}
    required
     />
)

// Select Field Component avec recherche
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
                className="w-full px-2 py-2.5 border border-gray-500/30 rounded outline-none text-gray-500 cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{selectedOption ? selectedOption.name : placeholder}</span>
                <span className="text-xs">▼</span>
            </div>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border-b border-gray-200 outline-none sticky top-0 bg-white"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {loading ? (
                        <div className="p-3 text-center text-gray-400">Chargement...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="p-3 text-center text-gray-400">Aucune option</div>
                    ) : (
                        filteredOptions.map(opt => (
                            <div
                                key={opt._id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
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

    const {axios, user, navigate, setShowUserLogin, fetchUser} = useAppContext();

    // Séparer le nom complet en prénom et nom (si possible)
    const getFirstAndLastName = () => {
        if (!user?.name) return { firstName: '', lastName: '' };
        const nameParts = user.name.split(' ');
        if (nameParts.length === 1) return { firstName: nameParts[0], lastName: '' };
        return { firstName: nameParts[0], lastName: nameParts.slice(1).join(' ') };
    };

    const { firstName: userFirstName, lastName: userLastName } = getFirstAndLastName();

    const [address, setAddress] = useState({
        firstName: userFirstName || '',
        lastName: userLastName || '',
        street: '',
        cityId: '',
        communeId: '',
        phone: user?.phone || '',
    })

    const [cities, setCities] = useState([])
    const [communes, setCommunes] = useState([])
    const [loadingCities, setLoadingCities] = useState(true)
    const [loadingCommunes, setLoadingCommunes] = useState(false)

    // Mettre à jour les champs quand l'utilisateur change
    useEffect(() => {
        const { firstName: newFirstName, lastName: newLastName } = getFirstAndLastName();
        setAddress(prev => ({
            ...prev,
            firstName: newFirstName || prev.firstName,
            lastName: newLastName || prev.lastName,
            phone: user?.phone || prev.phone,
        }));
    }, [user]);

    // Vérifier si l'utilisateur est connecté
    useEffect(() => {
        if (!user) {
            toast.error('Veuillez vous connecter pour ajouter une adresse');
            setShowUserLogin(true);
            navigate('/');
        }
    }, [user, navigate, setShowUserLogin]);

    // Charger les villes
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

    // Charger les communes en fonction de la ville sélectionnée
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
            // 1. Mettre à jour le profil utilisateur si les champs ont changé
            const userUpdateData = {};
            const fullName = `${address.firstName} ${address.lastName}`.trim();
            if (fullName !== user.name) {
                userUpdateData.name = fullName;
            }
            if (address.phone !== user.phone) {
                userUpdateData.phone = address.phone;
            }

            if (Object.keys(userUpdateData).length > 0) {
                await axios.post('/api/user/update', {
                    userId: user._id,
                    ...userUpdateData
                });
                fetchUser(); // Recharger les infos utilisateur
            }

            // 2. Ajouter l'adresse
            const {data} = await axios.post('/api/address/add', {address});

            if (data.success){
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
        <div className='mt-16 pb-16'>
            <p className='text-2xl md:text-3xl text-gray-500'>Ajouter une <span className='font-semibold text-primary'>adresse de livraison</span></p>
            <div className='flex flex-col-reverse md:flex-row justify-between mt-10'>
                <div className='flex-1 max-w-md'>
                    <form onSubmit={onSubmitHandler} className='space-y-3 mt-6 text-sm'>

                        <div className='grid grid-cols-2 gap-4'>
                            <InputField handleChange={handleChange} address={address} name='firstName' type="text" placeholder="Prénom"/>
                            <InputField handleChange={handleChange} address={address} name='lastName' type="text" placeholder="Nom"/>
                        </div>

                        <SelectField
                            name="cityId"
                            placeholder="Sélectionner une ville"
                            options={cities}
                            value={address.cityId}
                            handleChange={handleChange}
                            loading={loadingCities}
                        />

                        <SelectField
                            name="communeId"
                            placeholder={address.cityId ? "Sélectionner une commune" : "Sélectionnez d'abord une ville"}
                            options={communes}
                            value={address.communeId}
                            handleChange={handleChange}
                            loading={loadingCommunes}
                        />

                        <InputField handleChange={handleChange} address={address} name='street' type="text" placeholder="Quartier / Rue" />

                        <InputField handleChange={handleChange} address={address} name='phone' type="tel" placeholder="Téléphone" />

                        <button className='w-full mt-6 bg-primary text-white py-3 hover:bg-primary-dull transition cursor-pointer uppercase'>
                            Enregistrer l'adresse
                        </button>

                    </form>
                </div>
                <img className='md:mr-16 mb-16 md:mt-0' src={assets.add_address_iamge} alt="Add Address" />
            </div>
        </div>
    )
}

export default AddAddress