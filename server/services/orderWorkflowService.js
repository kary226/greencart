import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { crediterVenteEnAttente, libererFonds } from './walletService.js';
import { crediterClient } from './customerCreditService.js';

export const activeItems = (order) => (order.items || []).filter(i => i.availabilityStatus !== 'unavailable');

export const boutiquesConcernees = (order) => [...new Set(activeItems(order).map(i => i.boutiqueId?.toString()).filter(Boolean))];

export const availabilityState = (order) => {
  const expected = boutiquesConcernees(order);
  const decisions = new Map((order.availabilityDecisions || []).map(d => [d.boutiqueId.toString(), d]));
  const missing = expected.filter(id => !decisions.has(id));
  return { expected, missing, allAnswered: missing.length === 0 };
};

export const decideAvailability = async ({ orderId, boutiqueId, staffUser, availableItemIds = [], unavailableItemIds = [], reason = '' }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Commande introuvable');
  if (order.availabilityDecisions.some(d => d.boutiqueId.toString() === boutiqueId.toString())) throw new Error('La disponibilité de cette boutique a déjà été enregistrée');
  const itemIds = new Set((order.items || []).filter(i => i.boutiqueId?.toString() === boutiqueId.toString()).map(i => i._id.toString()));
  const allProvided = [...availableItemIds, ...unavailableItemIds].every(id => itemIds.has(id.toString()));
  if (!allProvided) throw new Error('Un article ne correspond pas à votre boutique');
  if (availableItemIds.length + unavailableItemIds.length === 0) throw new Error('Indiquez la disponibilité des articles');

  for (const item of order.items) {
    if (item.boutiqueId?.toString() !== boutiqueId.toString()) continue;
    const id = item._id.toString();
    if (unavailableItemIds.map(String).includes(id)) {
      item.availabilityStatus = 'unavailable';
      item.availabilityReason = reason || 'Article indisponible';
    } else if (availableItemIds.map(String).includes(id)) {
      item.availabilityStatus = 'available';
      item.availabilityReason = null;
    }
  }

  const decision = order.availabilityDecisions.find(d => d.boutiqueId.toString() === boutiqueId.toString());
  const payload = {
    boutiqueId,
    decision: unavailableItemIds.length ? 'unavailable' : 'available',
    unavailableItemIds,
    confirmePar: staffUser._id,
    confirmeParNom: staffUser.nom,
    confirmeLe: new Date(),
  };
  if (decision) Object.assign(decision, payload); else order.availabilityDecisions.push(payload);

  const before = order.amount;
  const unavailableValue = order.items.filter(i => i.boutiqueId?.toString() === boutiqueId.toString() && unavailableItemIds.map(String).includes(i._id.toString())).reduce((s,i)=>s+(Number(i.priceAtOrder)||0)*(Number(i.quantity)||0),0);
  if (unavailableValue > 0) {
    order.amount = Math.max(0, Number(order.amount || 0) - unavailableValue);
    order.customerRefundDue = Math.max(0, Number(order.customerRefundDue || 0) + unavailableValue);
    if (order.isPaid && order.paymentType !== 'COD') {
      await crediterClient({ userId: order.userId, amount: unavailableValue, orderId: order._id, reason: `Article indisponible — commande ${order._id}`, idempotencyKey: `unavailable:${order._id}:${unavailableItemIds.map(String).sort().join(',')}` });
      order.customerRefundCredited = Math.min(order.customerRefundDue, Number(order.customerRefundCredited || 0) + unavailableValue);
    }
  }

  const state = availabilityState(order);
  if (state.allAnswered) {
    order.status = activeItems(order).length ? 'Confirmed' : 'Cancelled';
    if (activeItems(order).length) await crediterVenteEnAttente(order);
  } else {
    order.status = 'Checking Availability';
  }
  await order.save();
  return { order, beforeAmount: before, afterAmount: order.amount, state };
};

export const reserveCollection = async ({ orderId, livreurId }) => {
  const now = new Date();
  const expiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const order = await Order.findOneAndUpdate({ _id: orderId, status: { $in: ['Confirmed','Collecting'] }, $or: [{ collecteReserveePar: null }, { collecteReservationExpireLe: { $lt: now } }] }, { $set: { collecteReserveePar: livreurId, collecteReserveeLe: now, collecteReservationExpireLe: expiry, status: 'Collecting' } }, { new: true });
  if (!order) throw new Error('Cette collecte est déjà réservée ou indisponible');
  return order;
};

export const collectItem = async ({ orderId, itemId, livreurId }) => {
  const order = await Order.findOne({ _id: orderId, collecteReserveePar: livreurId, status: 'Collecting' });
  if (!order) throw new Error('Collecte non réservée par ce livreur');
  const item = order.items.id(itemId);
  if (!item) throw new Error('Article introuvable');
  if (item.availabilityStatus === 'unavailable') throw new Error('Article indisponible');
  if (item.availabilityStatus === 'collected') return order;
  item.availabilityStatus = 'collected';
  item.collectedAt = new Date();
  item.collectedBy = livreurId;
  const remaining = activeItems(order).some(i => i.availabilityStatus !== 'collected');
  if (!remaining) { order.status = 'Ready for Shipment'; order.collecteTermineeLe = new Date(); }
  await order.save();
  return order;
};

export const markReceivedAndShipped = async ({ orderId, sellerId }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Commande introuvable');
  if (order.status !== 'Ready for Shipment') throw new Error('La collecte n’est pas terminée');
  order.entrepotRecuLe = new Date();
  order.shippedAt = new Date();
  order.shippedBy = sellerId;
  order.status = 'Shipped';
  await order.save();
  return libererFonds(order);
};
