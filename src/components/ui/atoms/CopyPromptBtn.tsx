import React, { useState } from 'react';
import { Button } from './Button.js';

interface CopyPromptBtnProps {
  filePath: string;
}

/**
 * Copies a prompt for the LLM to re-read the edited file.
 * REQ-18, Design §Botón CopyPromptBtn.
 */
export function CopyPromptBtn({ filePath }: CopyPromptBtnProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleClick = async (): Promise<void> => {
    const prompt = `Edité '${filePath}'. Re-leelo con doc_read y continuá la fase.`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="secondary" onClick={() => void handleClick()} title="Copiar prompt para LLM">
      {copied ? '¡Copiado!' : 'Copiar prompt para LLM'}
    </Button>
  );
}
