"use client";

import React from "react";
import { useForm, FormProvider, type UseFormReturn, type DefaultValues, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { logger } from "@/lib/logger";

export interface FormWrapperProps<TFieldValues extends FieldValues> {
  schema: z.Schema<TFieldValues> | any;
  onSubmit: (values: TFieldValues, form: UseFormReturn<TFieldValues>) => void | Promise<void>;
  defaultValues?: DefaultValues<TFieldValues>;
  children: React.ReactNode;
  className?: string;
  id?: string;
  error?: string | null;
  shouldUnregister?: boolean;
}

export function FormWrapper<TFieldValues extends FieldValues>({
  schema,
  onSubmit,
  defaultValues,
  children,
  className = "space-y-4",
  id,
  error,
  shouldUnregister = false,
}: FormWrapperProps<TFieldValues>) {
  const form = useForm<TFieldValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
    shouldUnregister,
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  return (
    <FormProvider {...form}>
      <form
        id={id}
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values, form);
          } catch (err: any) {
            logger.error({ err }, "Form submit wrapper captured error");
          }
        })}
        className={className}
      >

        {error && (
          <Alert intent="error" className="mt-4 mb-4 w-full max-w-xl mx-auto">
            {error}
          </Alert>
        )}
        
        <fieldset disabled={isSubmitting} className="space-y-4 w-full border-none p-0 m-0">
          {children}
        </fieldset>
      </form>
    </FormProvider>
  );
}
