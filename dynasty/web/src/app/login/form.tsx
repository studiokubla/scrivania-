"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type LoginState } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="bottone bottone-primario" style={{ width: "100%" }} disabled={pending}>
      {pending ? "Verifica…" : "Entra"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="etichetta" htmlFor="email">
          Indirizzo email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="campo"
          placeholder="nome@esempio.it"
        />
      </div>

      <div>
        <label className="etichetta" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
        />
      </div>

      {state.error && (
        <div className="avviso avviso-errore" role="alert">
          {state.error}
        </div>
      )}

      <Submit />
    </form>
  );
}
