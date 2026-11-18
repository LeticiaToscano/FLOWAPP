"use client"

import * as React from "react"
import { SignInStyles } from "./sign-in-page"

/**
 * Cadastro e recuperação de senha no mesmo visual da SignInPage: as mesmas classes sip-*, o mesmo vidro, a mesma
 * entrada em sequência e a mesma foto à direita. Os estilos vêm da SignInPage (SignInStyles).
 *
 * - modo "criar": e-mail e senha nova (com o olho e a regra da senha), botão "Criar conta" e "Já tem conta? Entrar".
 * - modo "recuperar": só o e-mail, botão "Enviar link" e "Lembrou a senha? Entrar".
 */

export type SignUpPageProps = {
  modo: "criar" | "recuperar"
  title?: React.ReactNode
  description?: React.ReactNode
  heroImageSrc?: string
  /** Algo para mostrar acima do formulário (um aviso de erro ou de sucesso). */
  aviso?: React.ReactNode
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  onSignIn?: () => void
  theme?: "system" | "dark" | "light"
  className?: string
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {off ? (
        <>
          <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
          <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
          <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
          <path d="m2 2 20 20" />
        </>
      ) : (
        <>
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

const step = (n: number) => ({ "--sip-delay": n * 100 + "ms" }) as React.CSSProperties

export function SignUpPage({ modo, title, description, heroImageSrc, aviso, onSubmit, onSignIn, theme = "system", className }: SignUpPageProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const id = React.useId()
  const criar = modo === "criar"

  return (
    <div className={"sip" + (className ? " " + className : "")} data-theme={theme}>
      <SignInStyles />
      <div className="sip__inner">
        <section className="sip__form-col">
          <div className="sip__form-wrap">
            <h1 className="sip-title sip-in" style={step(1)}>
              {title ?? <span className="sip-title__light">{criar ? "Criar conta" : "Recuperar senha"}</span>}
            </h1>
            <p className="sip-description sip-in" style={step(2)}>
              {description ?? (criar ? "Comece a planejar sua próxima viagem" : "Enviaremos um link para você criar uma senha nova")}
            </p>

            {aviso && <div className="sip-in" style={step(2)}>{aviso}</div>}

            <form className="sip-form" onSubmit={onSubmit} noValidate>
              {criar && (
                <div className="sip-in" style={step(3)}>
                  <label className="sip-label" htmlFor={id + "-nome"}>Como podemos te chamar?</label>
                  <div className="sip-field">
                    <input id={id + "-nome"} className="sip-input" name="nome" type="text" autoComplete="given-name" placeholder="Seu nome" maxLength={60} required />
                  </div>
                </div>
              )}
              <div className="sip-in" style={step(3)}>
                <label className="sip-label" htmlFor={id + "-email"}>E-mail</label>
                <div className="sip-field">
                  <input id={id + "-email"} className="sip-input" name="email" type="email" inputMode="email" autoComplete="email" placeholder="Digite seu e-mail" required />
                </div>
              </div>

              {criar && (
                <div className="sip-in" style={step(4)}>
                  <label className="sip-label" htmlFor={id + "-password"}>Senha</label>
                  <div className="sip-field sip-field--password">
                    <input
                      id={id + "-password"}
                      className="sip-input"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Crie uma senha"
                      aria-describedby={id + "-regra"}
                      required
                    />
                    <button
                      type="button"
                      className="sip-eye"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? "Esconder a senha" : "Mostrar a senha"}
                      aria-pressed={showPassword}
                    >
                      <EyeIcon off={showPassword} />
                    </button>
                  </div>
                  <p id={id + "-regra"} className="sip-description" style={{ fontSize: 13, lineHeight: "18px", marginTop: 8 }}>
                    Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.
                  </p>
                </div>
              )}

              <button type="submit" className="sip-submit sip-in" style={step(criar ? 5 : 4)}>
                {criar ? "Criar conta" : "Enviar link"}
              </button>
            </form>

            <p className="sip-signup sip-in" style={step(criar ? 6 : 5)}>
              {criar ? "Já tem conta?" : "Lembrou a senha?"}{" "}
              <a href="#" className="sip-link" onClick={e => { e.preventDefault(); onSignIn?.() }}>
                Entrar
              </a>
            </p>
          </div>
        </section>

        {heroImageSrc && (
          <section className="sip__hero-col">
            <div className="sip-hero sip-in-right" style={{ ...step(3), backgroundImage: `url(${JSON.stringify(heroImageSrc)})` }} />
          </section>
        )}
      </div>
    </div>
  )
}
