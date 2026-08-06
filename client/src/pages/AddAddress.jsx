import React, { useEffect, useRef, useState } from 'react'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import { ChevronDown, Search, Check } from 'lucide-react'

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

/**
 * Sélecteur ville / commune.
 *
 * La version d'origine était un <div onClick> : ni focalisable, ni annoncé
 * comme un contrôle, ni utilisable au clavier — sur un formulaire de
 * livraison obligatoire, un client au clavier ou au lecteur d'écran ne
 * pouvait tout simplement pas choisir sa ville. Il est maintenant construit
 * sur un <button> + role="listbox", avec fermeture par Échap et par clic
 * extérieur (les deux manquaient aussi).
 */
const SelectField = ({ name, placeholder, options, value, handleChange, loading, id }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const wrapRef = useRef(null)
    const searchRef = useRef(null)

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const selectedOption = options.find(opt => opt._id === value)

    useEffect(() => {
        if (!isOpen) return
        const onClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setIsOpen(false)
        }
        const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false) }
        document.addEventListener('mousedown', onClickOutside)
        document.addEventListener('keydown', onKey)
        // Le focus part sur la recherche : sur une liste de communes, c'est
        // ce que l'utilisateur veut faire en premier.
        searchRef.current?.focus()
        return () => {
            document.removeEventListener('mousedown', onClickOutside)
            document.removeEventListener('keydown', onKey)
        }
    }, [isOpen])

    const choisir = (opt) => {
        handleChange({ target: { name, value: opt._id } })
        setIsOpen(false)
        setSearchTerm('')
    }

    return (
        <div className="relative" ref={wrapRef}>
            <button
                type="button"
                id={id}
                onClick={() => setIsOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className="rs-input flex items-center justify-between gap-2 text-left"
            >
                <span className={selectedOption ? 'text-ink-900' : 'text-ink-400'}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <ChevronDown
                    size={17}
                    className={`text-ink-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-20 w-full mt-2 bg-ink-0 border border-ink-100 rounded-xl shadow-lg max-h-64 overflow-auto">
                    <div className="sticky top-0 bg-ink-0 p-2 border-b border-ink-100">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Rechercher…"
                                aria-label="Filtrer la liste"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="rs-input !min-h-[40px] pl-9 text-[16px]"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <p className="p-5 text-center text-ink-400 text-[13px]">Chargement…</p>
                    ) : filteredOptions.length === 0 ? (
                        <p className="p-5 text-center text-ink-400 text-[13px]">
                            {searchTerm ? <>Aucun résultat pour « {searchTerm} »</> : 'Aucune option disponible'}
                        </p>
                    ) : (
                        <ul role="listbox" aria-label={placeholder} className="list-none m-0 p-1">
                            {filteredOptions.map(opt => {
                                const actif = opt._id === value
                                return (
                                    <li key={opt._id}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={actif}
                                            onClick={() => choisir(opt)}
                                            className={`w-full text-left px-3 min-h-[44px] flex items-center justify-between gap-2 rounded-lg text-[14px] transition ${
                                                actif ? 'bg-ramses-50 text-ramses-700 font-semibold' : 'text-ink-700 hover:bg-ink-50'
                                            }`}
                                        >
                                            {opt.name}
                                            {actif && <Check size={16} className="shrink-0" />}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
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
                                <SelectField
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
                                <SelectField
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
