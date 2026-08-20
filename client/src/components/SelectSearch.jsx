import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'

/**
 * Liste déroulante avec recherche, accessible au clavier.
 *
 * Ce composant existait en double, copié-collé dans AddAddress.jsx et
 * Account.jsx, dans les deux cas sous la forme d'un `<div onClick>` : ni
 * focalisable, ni annoncé comme un contrôle, ni fermable au clavier. Sur un
 * formulaire de livraison obligatoire, un client au clavier ou au lecteur
 * d'écran ne pouvait tout simplement pas choisir sa ville.
 *
 * Version unique, construite sur `<button>` + `role="listbox"`, avec
 * fermeture par Échap et par clic extérieur — les deux manquaient aussi.
 */
const SelectSearch = ({ name, placeholder, options = [], value, handleChange, loading, icon: Icon, id }) => {
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
        // Sur une liste de communes, filtrer est la première chose qu'on veut faire.
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
                className="rs-input flex items-center justify-between gap-2 text-left cursor-pointer"
            >
                <span className="flex items-center gap-2 min-w-0">
                    {Icon && <Icon size={17} className="text-ink-400 shrink-0" />}
                    <span className={`truncate ${selectedOption ? 'text-ink-900' : 'text-ink-400'}`}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </span>
                </span>
                <ChevronDown
                    size={17}
                    className={`text-ink-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="rs-float absolute z-20 w-full mt-2 rounded-xl max-h-64 overflow-auto">
                    <div className="sticky top-0 bg-ink-0 p-2 border-b border-ink-100">
                        <div className="relative">
                            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Rechercher…"
                                aria-label="Filtrer la liste"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="rs-input rs-input--icon-l !min-h-[40px]"
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
                                            className={`w-full text-left px-3 min-h-[44px] flex items-center justify-between gap-2 rounded-lg text-[14px] cursor-pointer transition ${
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

export default SelectSearch