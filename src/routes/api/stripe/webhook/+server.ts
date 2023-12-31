import { deleteCustomerRecord, updateCustomerRecord } from "$lib/server/customers";
import { deleteProductRecord, upsertProductRecord } from "$lib/server/products";
import { insertSubscriptionRecord, updateSubscriptionRecord } from "$lib/server/subscriptions";

import { ENV } from "$lib/server/env";
import type { RequestHandler } from "./$types";
import type Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { stripe } from "$lib/server/stripe";

export const POST: RequestHandler = async (event) => {
  const stripeSignature = event.request.headers.get("stripe-signature");

  if (!stripeSignature) {
    return json("Unauthorized", { status: 401 });
  }

  const body = await event.request.text();

  let stripeEvent: Stripe.DiscriminatedEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      body,
      stripeSignature,
      ENV.STRIPE_SIGNING_SECRET
    ) as Stripe.DiscriminatedEvent;
  } catch (e) {
    return json("Invalid signature", { status: 401 });
  }

  try {
    switch (stripeEvent.type) {
      case "product.created":
      case "product.updated":
        await upsertProductRecord(stripeEvent.data.object);
        break;
      case "product.deleted":
        await deleteProductRecord(stripeEvent.data.object);
        break;
      case "customer.updated":
        await updateCustomerRecord(stripeEvent.data.object);
        break;
      case "customer.deleted":
        await deleteCustomerRecord(stripeEvent.data.object);
        break;
      case "customer.subscription.created":
        await insertSubscriptionRecord(stripeEvent.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await updateSubscriptionRecord(stripeEvent.data.object);
        break;
      case "customer.subscription.trial_will_end":
        console.log("Customer Subcription trial will end", stripeEvent);
        break;
      default:
        console.warn(`Unhandled event type: ${stripeEvent.type}`);
        return json({ recieved: true }, { status: 200 });
    }
  } catch (e) {
    console.log(e);
    return json(`Error processing event ${stripeEvent.type}`, { status: 500 });
  }

  return json({ received: true }, { status: 200 })
};
