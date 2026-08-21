import CustomerCreditTransaction from '../models/CustomerCredit.js';

export const crediterClient = async ({ userId, amount, orderId, itemId, reason, idempotencyKey }) => {
  if (!userId || !amount || amount <= 0) return null;
  const exists = await CustomerCreditTransaction.findOne({ idempotencyKey });
  if (exists) return exists;
  return CustomerCreditTransaction.create({ userId, type: 'credit', amount, orderId, itemId, reason, idempotencyKey });
};

export const debiterCreditClient = async ({ userId, amount, orderId }) => {
  if (!amount || amount <= 0) return null;
  const balance = await soldeCreditClient(userId);
  if (balance < amount) throw new Error('Solde de crédit client insuffisant');
  return CustomerCreditTransaction.create({ userId, type: 'debit', amount, orderId, reason: `Utilisation crédit — commande ${orderId}`, idempotencyKey: `debit:${orderId}` });
};

export const soldeCreditClient = async (userId) => {
  const rows = await CustomerCreditTransaction.aggregate([
    { $match: { userId: userId } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } }
  ]);
  const credits = rows.find(r => r._id === 'credit')?.total || 0;
  const debits = rows.find(r => r._id === 'debit')?.total || 0;
  return Math.max(0, credits - debits);
};
