import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppContext } from '../context/AppContext'
import {
    ArrowLeft, CalendarDays, Check, ChevronRight, Copy, CreditCard,
    Package, ShoppingBag, Truck,
} from 'lucide-react'
import '../styles/order-success.css'

/**
 * Page affichée juste après une commande réussie (paiement à la livraison ET
 * paiement Mobile Money confirmé), à la place du simple toast.
 *
 * Données : la commande arrive d'abord par `location.state.order` (affichage
 * instantané, sans requête). Si la page est rechargée ou ouverte
 * directement, on la relit via /api/order/:orderId — qui ne renvoie que les
 * commandes du client connecté.
 */

// ── Badge « sceau » vert à bords festonnés ──────────────────────────────────
// Un cercle dont le rayon ondule (8 lobes) : plus net et plus léger qu'une
// image, et il reste net sur les écrans haute densité.
const cheminSceau = (cx, cy, rayon, amplitude, lobes, pas = 160) => {
    const pts = []
    for (let i = 0; i < pas; i++) {
        const a = (i / pas) * Math.PI * 2
        const r = rayon + amplitude * Math.cos(lobes * a)
        pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
    }
    return `M${pts.join('L')}Z`
}
const SCEAU = cheminSceau(62, 62, 48, 5, 8)

// ── Confettis : valeurs fixes (pas d'aléatoire → pas de scintillement au
// re-rendu, et un rendu identique d'une visite à l'autre) ───────────────────
const COULEURS = [
    'var(--color-ramses-600)', 'var(--color-ink-900)',
    'var(--color-ok-500)', 'var(--color-ramses-300)',
]
const PARTICULES = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.12
    const dist = 78 + ((i * 37) % 64)
    return {
        x: Math.round(Math.cos(angle) * dist),
        y: Math.round(Math.sin(angle) * dist) - 24,
        rot: ((i * 83) % 420) - 210,
        d: (0.68 + (i % 6) * 0.03).toFixed(2),
        c: COULEURS[i % COULEURS.length],
        w: 6 + (i % 3) * 2,
        h: 9 + (i % 4) * 2,
        r: i % 2 ? '50%' : '2px',
    }
})

const fmtDate = (d, opts) => new Date(d).toLocaleDateString('fr-FR', opts)

export default function OrderSuccess() {
    const { orderId } = useParams()
    const { state } = useLocation()
    const navigate = useNavigate()
    const { currency, axios } = useAppContext()

    const [order, setOrder] = useState(state?.order || null)
    const [etat, setEtat] = useState(state?.order ? 'pret' : 'chargement')
    const [copie, setCopie] = useState(false)
    const titreRef = useRef(null)

    // Rechargement de la page / lien direct : on relit la commande.
    useEffect(() => {
        if (order) return
        let annule = false
        axios.get(`/api/order/${orderId}`)
            .then(({ data }) => {
                if (annule) return
                if (data.success && data.order) {
                    setOrder(data.order)
                    setEtat('pret')
                } else {
                    setEtat('introuvable')
                }
            })
            .catch(() => { if (!annule) setEtat('introuvable') })
        return () => { annule = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId])

    // Au moment où le résultat apparaît : le titre prend le focus (lecteurs
    // d'écran : « Commande réussie ») et un léger retour haptique sur mobile.
    useEffect(() => {
        if (etat !== 'pret') return
        titreRef.current?.focus({ preventScroll: true })
        try { navigator.vibrate?.([18, 40, 18]) } catch { /* non supporté */ }
    }, [etat])

    const reference = String(orderId).slice(-8).toUpperCase()

    const copier = async () => {
        try {
            await navigator.clipboard.writeText(reference)
            setCopie(true)
            setTimeout(() => setCopie(false), 1800)
        } catch {
            toast.error('Copie impossible sur cet appareil')
        }
    }

    const infos = useMemo(() => {
        if (!order) return null
        const date = order.createdAt ? new Date(order.createdAt) : new Date()
        const livraison = order.estimatedDeliveryStart && order.estimatedDeliveryEnd
            ? `du ${fmtDate(order.estimatedDeliveryStart, { day: 'numeric', month: 'short' })} au ${fmtDate(order.estimatedDeliveryEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`
            : null
        return {
            date: `${fmtDate(date, { day: 'numeric', month: 'short', year: 'numeric' })} – ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
            livraison,
            // À la livraison, rien n'est encore payé : dire « Montant payé »
            // serait faux et le client croirait avoir déjà réglé.
            aLaLivraison: order.paymentType === 'COD',
            montant: Number(order.amount || 0).toLocaleString('fr-FR'),
        }
    }, [order])

    const entete = (
        <div className="os-header relative">
            <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Retour à l'accueil"
                className="rs-icon-btn relative z-10"
            >
                <ArrowLeft size={20} />
            </button>
            <span className="os-header-title">Commande</span>
        </div>
    )

    // ── Chargement ──────────────────────────────────────────────────────────
    if (etat === 'chargement') {
        return (
            <div className="os-page" aria-busy="true">
                {entete}
                <main className="os-wrap">
                    <div className="os-card" style={{ animation: 'none' }}>
                        <div className="os-skeleton" style={{ height: 28, width: '70%', margin: '0 auto 12px' }} />
                        <div className="os-skeleton" style={{ height: 16, width: '85%', margin: '0 auto 28px' }} />
                        <div className="os-skeleton" style={{ height: 170 }} />
                    </div>
                </main>
            </div>
        )
    }

    // ── Commande introuvable (lien d'un autre compte, supprimée…) ───────────
    if (etat === 'introuvable') {
        return (
            <div className="os-page">
                {entete}
                <main className="os-wrap">
                    <div className="os-card" style={{ paddingTop: 28 }}>
                        <h1 className="os-title" style={{ fontSize: 22 }}>Commande introuvable</h1>
                        <p className="os-sub">
                            Nous n'avons pas pu afficher cette commande. Si vous venez de commander,
                            retrouvez-la dans vos commandes.
                        </p>
                        <div className="os-actions">
                            <Link to="/my-orders" className="os-btn os-btn--primary">
                                Voir mes commandes <ChevronRight size={20} />
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    // ── Succès ──────────────────────────────────────────────────────────────
    return (
        <div className="os-page">
            {entete}

            <main className="os-wrap">
                <div className="os-card">
                    {/* Badge + onde + confettis */}
                    <div className="os-badge-wrap" aria-hidden="true">
                        <span className="os-ring" />
                        <span className="os-ring os-ring--2" />
                        <svg className="os-badge" viewBox="0 0 124 124">
                            <defs>
                                <linearGradient id="os-grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0" stopColor="#3FE0A0" />
                                    <stop offset="1" stopColor="#0E9F6E" />
                                </linearGradient>
                            </defs>
                            {/* Épaisseur : même forme décalée, plus sombre */}
                            <path d={SCEAU} transform="translate(0 5)" fill="#0A7A55" opacity=".55" />
                            <path d={SCEAU} fill="url(#os-grad)" />
                            <ellipse cx="46" cy="38" rx="22" ry="11" fill="#fff" opacity=".22" transform="rotate(-24 46 38)" />
                            <path
                                className="os-check"
                                d="M40 63 L55 78 L85 47"
                                fill="none"
                                stroke="#fff"
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <div className="os-confetti">
                            {PARTICULES.map((p, i) => (
                                <i
                                    key={i}
                                    style={{
                                        '--x': `${p.x}px`, '--y': `${p.y}px`, '--rot': `${p.rot}deg`,
                                        '--d': `${p.d}s`, '--c': p.c, '--w': `${p.w}px`, '--h': `${p.h}px`, '--r': p.r,
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <h1 ref={titreRef} tabIndex={-1} className="os-title" aria-live="polite">
                        Commande réussie !
                    </h1>
                    <p className="os-sub">
                        Merci pour votre achat. Votre commande a bien été enregistrée.
                        {infos.aLaLivraison && ' Vous paierez à la réception de votre colis.'}
                    </p>

                    <div className="os-details">
                        <div className="os-row">
                            <span className="os-row-icon os-row-icon--brand"><ShoppingBag size={22} /></span>
                            <div className="os-row-body">
                                <span className="os-row-label">Numéro de commande</span>
                                <span className="os-row-value">#{reference}</span>
                            </div>
                            <button
                                type="button"
                                onClick={copier}
                                className={`os-copy ${copie ? 'os-copy--done' : ''}`}
                                aria-label={copie ? 'Numéro copié' : 'Copier le numéro de commande'}
                            >
                                {copie ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>

                        <div className="os-row">
                            <span className="os-row-icon"><CalendarDays size={22} /></span>
                            <div className="os-row-body">
                                <span className="os-row-label">Date de commande</span>
                                <span className="os-row-value">{infos.date}</span>
                            </div>
                        </div>

                        <div className="os-row">
                            <span className="os-row-icon"><CreditCard size={22} /></span>
                            <div className="os-row-body">
                                <span className="os-row-label">
                                    {infos.aLaLivraison ? 'Montant à payer à la livraison' : 'Montant payé'}
                                </span>
                                <span className="os-row-value os-row-value--money">
                                    {infos.montant} {currency}
                                </span>
                            </div>
                        </div>

                        {infos.livraison && (
                            <div className="os-row">
                                <span className="os-row-icon"><Truck size={22} /></span>
                                <div className="os-row-body">
                                    <span className="os-row-label">Livraison estimée</span>
                                    <span className="os-row-value">{infos.livraison}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="os-actions">
                    <Link to="/" className="os-btn os-btn--primary">
                        Continuer mes achats <ChevronRight size={20} />
                    </Link>
                    <Link to={`/my-orders/${orderId}`} className="os-btn os-btn--secondary">
                        <Package size={20} /> Suivre ma commande
                    </Link>
                </div>
            </main>
        </div>
    )
}