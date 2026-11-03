import "server-only";
import type { ConnectorId } from "../methods";
import { paypal } from "./paypal";
import { satim } from "./satim";
import { stripe } from "./stripe";
import type { ConnectorClient } from "./types";

// Connectors that are implemented (algerie_poste is listed in methods.ts but not available)
export const clients: Partial<Record<ConnectorId, ConnectorClient>> = { stripe, paypal, satim };
