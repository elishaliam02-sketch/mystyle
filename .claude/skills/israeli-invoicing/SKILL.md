---
name: israeli-invoicing
description: Issuing legal Israeli tax invoices/receipts (חשבונית מס / קבלה) for subscription payments, VAT (מע״מ), and choosing between keeping Stripe with an invoicing service vs. a local Israeli payment processor (מסלקה — Cardcom / PayPlus / Tranzila / Grow-Meshulam). Use for anything about Israeli billing compliance, invoices, receipts, or local card/bit collection.
---

# Israeli invoicing & מסלקה

Stripe collects money but does NOT issue an Israeli tax invoice. A registered
עוסק/חברה must issue a חשבונית מס/קבלה for every charge, so invoicing is a real,
separate requirement — not optional once you are billing Israeli customers.

## Two honest architectures
**A. Keep Stripe + an automatic invoicing service (recommended to start).**
- Stripe stays exactly as built (checkout/portal/webhook/entitlement).
- Connect an Israeli invoicing API — Green Invoice (חשבונית ירוקה) or iCount — that
  issues a legal invoice/receipt per payment and emails it to the customer.
- Trigger it SERVER-SIDE off the same verified Stripe webhook event
  (`customer.subscription.updated` / `invoice.paid`), never from the phone. Make it
  idempotent per Stripe event id, the same way `billing_events` already guards double
  application.
- Fastest path: no change to how customers pay, just adds the legal document.

**B. Move collection to a local Israeli processor (מסלקה).**
- Cardcom / PayPlus / Tranzila / Grow(Meshulam) collect cards (and often bit/Apple
  Pay/Google Pay) AND issue the invoice themselves.
- Better for local cards, bit, and Hebrew billing UX; means replacing the Stripe
  checkout/webhook layer with the processor's, keeping `src/billing/plans.ts` and the
  paywall and the single `entitlement` concept unchanged.
- More work than A; choose it when local payment methods or an all-in-one invoice+cards
  flow matter more than reusing what is built.

## Rules
1. Invoices are issued from a VERIFIED payment event on the server. The client is never
   trusted to say "issue an invoice".
2. Idempotent per payment: a webhook retry must not issue a second invoice.
3. Store the invoice id/number and a link back on the subscription/payment record for the
   admin console and support.
4. VAT: the paywall states prices as VAT-inclusive. The rate and whether you charge VAT
   is an accountant decision; the code just has to reflect whatever is true, and the
   invoice must show VAT correctly. Never hardcode a VAT rate in two places.
5. Keep processor/invoicing API keys server-side only (Supabase secrets), like the
   Stripe secret.
6. This is a business/tax decision as much as a technical one — surface the tradeoff
   (fees, local methods, who issues the invoice) to the owner; do not silently pick a
   processor that changes their tax setup.

## Definition of done
- Every successful charge produces exactly one legal invoice/receipt to the customer.
- A webhook replay produces zero duplicate invoices.
- The invoice reference is queryable from the admin/support surface.
- Keys are server-side; `npx tsc --noEmit` and the billing tests pass.
