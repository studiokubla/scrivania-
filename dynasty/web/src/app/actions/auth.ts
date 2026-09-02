"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticate, createSession, destroySession } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email("Indirizzo non valido"),
  password: z.string().min(1, "Serve la password"),
});

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const session = await authenticate(parsed.data.email, parsed.data.password);
  // Messaggio unico: distinguere "utente inesistente" da "password errata"
  // direbbe a un estraneo quali indirizzi sono registrati nella lega.
  if (!session) return { error: "Indirizzo o password non corretti." };

  await createSession(session);
  redirect("/lega");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
