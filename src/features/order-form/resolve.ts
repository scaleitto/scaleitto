import { resolveForm } from "@/features/landing/types";

// The one order form: every form (store product page, landing page) is the store's form
export const storeForm = (shop: { orderForm: unknown }) => resolveForm(shop.orderForm);
