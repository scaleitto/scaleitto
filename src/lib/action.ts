// What every form server action returns. `error` and `fieldErrors` hold message keys
// from the `errors` dictionary, so the browser shows them in the user's language.
export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

export const initialActionState: ActionState = {};
