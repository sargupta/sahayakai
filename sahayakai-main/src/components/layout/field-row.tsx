"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { InlineMicButton } from "./inline-mic-button";

/**
 * FieldRow — canonical form-field wrapper.
 *
 * Standardises label + input + helper + optional inline mic. Any text-
 * accepting field should use this — it's how voice-first becomes the
 * default without per-page wiring.
 *
 * Usage:
 *   <FieldRow label="Topic" helper="What do you want to teach today?">
 *     <Input value={topic} onChange={e => setTopic(e.target.value)} />
 *   </FieldRow>
 *
 * To turn off the mic for non-text fields (Select, Switch, etc.):
 *   <FieldRow label="Grade" mic={false}>
 *     <Select>...</Select>
 *   </FieldRow>
 *
 * The mic appends to the input's existing value (with a space). Pass
 * `onMicTranscript` to override that behaviour.
 */
export interface FieldRowProps {
  label: string;
  helper?: string;
  required?: boolean;
  /** Show inline mic? Default true — voice-first by default. */
  mic?: boolean;
  /** BCP-47 override for mic recognition. */
  micLang?: string;
  /** Custom transcript handler. Default: append final transcript to input.value. */
  onMicTranscript?: (text: string, isFinal: boolean) => void;
  /** Optional id forwarded to the label's htmlFor and the child input's id. */
  htmlFor?: string;
  className?: string;
  /** The input element — typically <Input>, <Textarea>, <Select>, etc. */
  children: ReactNode;
}

export function FieldRow({
  label,
  helper,
  required,
  mic = true,
  micLang,
  onMicTranscript,
  htmlFor,
  className,
  children,
}: FieldRowProps) {
  // Default mic handler: append final transcript to the underlying input's value
  // by triggering a synthetic onChange. Works for controlled inputs where the
  // child receives `onChange`.
  const defaultMicHandler = (text: string, isFinal: boolean) => {
    if (!isFinal || !text || !isValidElement(children)) return;
    const child = children as ReactElement<any>;
    const onChange = child.props.onChange;
    const currentValue: string = child.props.value ?? "";
    const next = currentValue ? `${currentValue} ${text}` : text;
    if (typeof onChange === "function") {
      // Synthesise a minimal change event — sufficient for controlled inputs.
      onChange({ target: { value: next } } as any);
    }
  };

  const micHandler = onMicTranscript ?? defaultMicHandler;

  // If we're rendering the mic, inject id onto the child input for label linkage.
  const renderedChild =
    htmlFor && isValidElement(children)
      ? cloneElement(children as ReactElement<any>, {
          id: (children as ReactElement<any>).props.id ?? htmlFor,
        })
      : children;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="type-caption text-foreground normal-case tracking-normal text-sm font-medium"
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
        {mic && (
          <InlineMicButton
            onTranscript={micHandler}
            lang={micLang}
          />
        )}
      </div>
      {renderedChild}
      {helper && (
        <p className="type-body text-muted-foreground text-xs">{helper}</p>
      )}
    </div>
  );
}
