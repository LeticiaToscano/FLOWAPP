"use client";

// Caixa de mensagem no estilo do componente "claude-style-chat-input" enviado, adaptada para a Lia:
// mesmo cartão, mesma área de texto que cresce sozinha (Enter envia, Shift+Enter quebra linha), mesma barra de ações
// com ferramentas à esquerda e o botão de enviar na cor de destaque à direita.
// O que saiu, porque a Lia ainda não faz: anexar arquivos, colar textos longos como cartão, escolher modelo e o
// "pensamento estendido". No lugar das ferramentas da esquerda entra o que o app passar em `ferramentas` (o microfone).
// Sem Tailwind: as classes do original viraram classes cci-* no styles.css. Ícones do Lucide desenhados aqui.

import { useEffect, useRef, type ReactNode } from "react";

export interface ClaudeChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  ferramentas?: ReactNode;
  autoFocus?: boolean;
}

export const IconeEnviar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
  </svg>
);

export function ClaudeChatInput({ value, onChange, onSend, disabled, placeholder = "Como posso ajudar na sua viagem?", ferramentas, autoFocus }: ClaudeChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A área de texto cresce com o conteúdo, até 384px (como no original)
  useEffect(() => {
    const t = textareaRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 384) + "px";
  }, [value]);

  const temConteudo = value.trim().length > 0;
  const enviar = () => { if (temConteudo && !disabled) onSend(); };

  return (
    <div className="cci">
      <div className="cci-card" onClick={() => textareaRef.current?.focus()}>
        <div className="cci-in">
          <div className="cci-area">
            <label htmlFor="cci-texto" className="sr-only">Mensagem para a Lia</label>
            <textarea
              id="cci-texto"
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); }
              }}
              placeholder={placeholder}
              rows={1}
              maxLength={1500}
              autoFocus={autoFocus}
            />
          </div>
          <div className="cci-barra">
            <div className="cci-esq">{ferramentas}</div>
            <button type="button" className="cci-enviar" onClick={enviar} disabled={!temConteudo || disabled} aria-label="Enviar mensagem">
              <IconeEnviar />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClaudeChatInput;
