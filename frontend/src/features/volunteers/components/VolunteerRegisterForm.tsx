import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  useForm,
  FormProvider,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  volunteerRegistrationSchema,
  type VolunteerRegistrationInput,
} from "../validations/volunteers.schema";
import { FormField, Button } from "@/components/ui";
import { StepIndicator, type StepConfig } from "@/components/ui/StepIndicator";
import { FileUpload } from "@/components/ui/FileUpload";
import { Alert } from "@/components/ui/Alert";
import { api } from "@/lib/api-client";
import { useVolunteerAuth } from "@/auth/VolunteerAuthProvider";

// ---------------------------------------------------------------------------
// Draft persistence helpers
// ---------------------------------------------------------------------------
const DRAFT_KEY = "laz_volunteer_reg_draft";
const STEP_KEY = "laz_volunteer_reg_step";

type UploadState = { url: string; publicId: string };
const EMPTY_UPLOAD: UploadState = { url: "", publicId: "" };

type UploadDraft = {
  photo: UploadState;
  ktp: UploadState;
  cv: UploadState;
};

const EMPTY_UPLOADS: UploadDraft = {
  photo: EMPTY_UPLOAD,
  ktp: EMPTY_UPLOAD,
  cv: EMPTY_UPLOAD,
};

function loadDraft(): Partial<VolunteerRegistrationInput> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<VolunteerRegistrationInput>;
    // Never restore password fields from draft
    delete parsed.password;
    delete parsed.confirmPassword;
    return parsed;
  } catch {
    return {};
  }
}

function loadUploadDraft(): UploadDraft {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY}_uploads`);
    return raw ? { ...EMPTY_UPLOADS, ...JSON.parse(raw) } : EMPTY_UPLOADS;
  } catch {
    return EMPTY_UPLOADS;
  }
}

function loadStep(): number {
  try {
    const raw = localStorage.getItem(STEP_KEY);
    return raw ? Math.max(0, Math.min(1, parseInt(raw, 10))) : 0;
  } catch {
    return 0;
  }
}

function saveDraft(data: Partial<VolunteerRegistrationInput>) {
  try {
    // Never persist password fields
    const { password, confirmPassword, ...safe } = data as any;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
  } catch {}
}

function saveUploadDraft(uploads: UploadDraft) {
  try {
    localStorage.setItem(`${DRAFT_KEY}_uploads`, JSON.stringify(uploads));
  } catch {}
}

function saveStep(step: number) {
  try {
    localStorage.setItem(STEP_KEY, String(step));
  } catch {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(`${DRAFT_KEY}_uploads`);
  localStorage.removeItem(STEP_KEY);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
const STEPS: StepConfig[] = [
  { label: "Data Diri & Keamanan", description: "Informasi & password" },
  { label: "Dokumen", description: "Upload dokumen (opsional)" },
];

const STEP_FIELDS: FieldPath<VolunteerRegistrationInput>[][] = [
  ["name", "email", "phone", "addressDomicile", "addressKtp", "password", "confirmPassword"],
  [], // uploads only — no required text fields
];

// ---------------------------------------------------------------------------
// Step panels
// ---------------------------------------------------------------------------
function Step1({ isPending }: { isPending: boolean }) {
  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-primary">Data Diri & Keamanan</h3>
        <p className="text-sm text-secondary">Isi informasi pribadi dan buat password akun Anda.</p>
      </div>
      <FormField name="name" label="Nama Lengkap" type="input" placeholder="Nama lengkap Anda" disabled={isPending} />
      <FormField name="email" label="Email" type="input" inputType="email" placeholder="nama@email.com" disabled={isPending} />
      <FormField name="phone" label="Nomor Telepon" type="input" inputType="tel" placeholder="081234567890" disabled={isPending} />
      <FormField name="addressDomicile" label="Alamat Domisili" required type="textarea" rows={2} placeholder="Alamat tempat tinggal saat ini" disabled={isPending} />
      <FormField name="addressKtp" label="Alamat KTP" required type="textarea" rows={2} placeholder="Alamat sesuai KTP" disabled={isPending} />

      <hr className="border-border/60 my-1" />
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Keamanan Akun</p>
      <FormField name="password" label="Password" type="input" inputType="password" placeholder="••••••••" disabled={isPending} />
      <FormField name="confirmPassword" label="Konfirmasi Password" type="input" inputType="password" placeholder="••••••••" disabled={isPending} />
    </div>
  );
}

function Step2({
  isPending,
  uploads,
  setUploads,
  submitAttempted,
}: {
  isPending: boolean;
  uploads: UploadDraft;
  setUploads: (fn: (prev: UploadDraft) => UploadDraft) => void;
  submitAttempted: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-primary">Dokumen Pendukung</h3>
        <p className="text-sm text-secondary">Upload dokumen berikut untuk melengkapi profil relawan Anda.</p>
      </div>

      <FileUpload
        name="photoUrl"
        label="Foto Diri (Wajib)"
        required
        forceValidate={submitAttempted}
        folder="volunteers/photo"
        disabled={isPending}
        initialUrl={uploads.photo.url}
        initialPublicId={uploads.photo.publicId}
        description="Pakaian berkemeja bebas, warna background bebas."
        onUpload={(p) => setUploads(prev => ({ ...prev, photo: p }))}
        onRemove={() => setUploads(prev => ({ ...prev, photo: EMPTY_UPLOAD }))}
      />
      <FileUpload
        name="ktpUrl"
        label="KTP (Wajib)"
        required
        forceValidate={submitAttempted}
        accept="image/png, image/jpeg, application/pdf"
        folder="volunteers/documents"
        disabled={isPending}
        initialUrl={uploads.ktp.url}
        initialPublicId={uploads.ktp.publicId}
        onUpload={(p) => setUploads(prev => ({ ...prev, ktp: p }))}
        onRemove={() => setUploads(prev => ({ ...prev, ktp: EMPTY_UPLOAD }))}
      />
      <FileUpload
        name="cvUrl"
        label="CV (Opsional)"
        accept="image/png, image/jpeg, application/pdf"
        folder="volunteers/documents"
        disabled={isPending}
        initialUrl={uploads.cv.url}
        initialPublicId={uploads.cv.publicId}
        onUpload={(p) => setUploads(prev => ({ ...prev, cv: p }))}
        onRemove={() => setUploads(prev => ({ ...prev, cv: EMPTY_UPLOAD }))}
      />
    </div>
  );
}


// ---------------------------------------------------------------------------
// Nav buttons
// ---------------------------------------------------------------------------
function StepNav({
  currentStep,
  totalSteps,
  isPending,
  onNext,
  onBack,
}: {
  currentStep: number;
  totalSteps: number;
  isPending: boolean;
  onNext: () => Promise<void>;
  onBack: () => void;
}) {
  const isLast = currentStep === totalSteps - 1;
  return (
    <div className={`flex gap-3 pt-4 ${currentStep > 0 ? "justify-between" : "justify-end"}`}>
      {currentStep > 0 && (
        <Button type="button" intent="outline" onClick={onBack} disabled={isPending} className="px-6">
          ← Kembali
        </Button>
      )}
      {isLast ? (
        <Button key="submit" type="submit" isLoading={isPending} className="flex-1 sm:flex-none px-8 text-sm font-semibold">
          Daftar sebagai Relawan
        </Button>
      ) : (
        <Button
          key="next"
          type="button"
          onClick={(event) => {
            // Cancel this click before validation can render the submit button.
            event.preventDefault();
            void onNext();
          }}
          disabled={isPending}
          className="flex-1 sm:flex-none px-8 text-sm font-semibold"
        >
          Lanjut →
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function VolunteerRegisterForm() {
  const navigate = useNavigate();
  const { refresh } = useVolunteerAuth();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const savedDraft = useRef(loadDraft());
  const savedUploads = useRef(loadUploadDraft());
  const [currentStep, setCurrentStep] = useState(() => loadStep());
  const [uploads, setUploads] = useState<UploadDraft>(() => savedUploads.current);

  const defaultValues: VolunteerRegistrationInput = {
    name: "",
    email: "",
    phone: "",
    addressDomicile: "",
    addressKtp: "",
    password: "",
    confirmPassword: "",
    photoUrl: "",
    photoPublicId: "",
    ktpUrl: "",
    ktpPublicId: "",
    cvUrl: "",
    cvPublicId: "",
    ...savedDraft.current,
  };

  const form = useForm<VolunteerRegistrationInput>({
    resolver: zodResolver(volunteerRegistrationSchema) as any,
    defaultValues,
    mode: "onTouched",
  });

  const { handleSubmit, trigger, watch } = form;

  // Auto-save draft (except password fields)
  useEffect(() => {
    const subscription = watch((values) => {
      saveDraft(values as Partial<VolunteerRegistrationInput>);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // Persist uploads
  useEffect(() => {
    saveUploadDraft(uploads);
  }, [uploads]);

  // Persist step
  useEffect(() => {
    saveStep(currentStep);
  }, [currentStep]);

  const handleSetUploads = useCallback(
    (fn: (prev: UploadDraft) => UploadDraft) => setUploads(fn),
    []
  );

  const handleNext = async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid = fields.length === 0 ? true : await trigger(fields);
    if (valid) {
      setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
      setError(null);
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
    setError(null);
  };

  const onSubmit = (data: VolunteerRegistrationInput) => {
    // Guard: only submit on the last step.
    if (currentStep !== STEPS.length - 1) {
      handleNext();
      return;
    }

    setSubmitAttempted(true);

    // Guard: validate wajib uploads
    if (!uploads.photo.url) {
      setError("Foto diri wajib diupload.");
      return;
    }
    if (!uploads.ktp.url) {
      setError("KTP wajib diupload.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await api.post("/volunteers/register", {
          ...data,
          photoUrl: uploads.photo.url || undefined,
          photoPublicId: uploads.photo.publicId || undefined,
          ktpUrl: uploads.ktp.url || undefined,
          ktpPublicId: uploads.ktp.publicId || undefined,
          cvUrl: uploads.cv.url || undefined,
          cvPublicId: uploads.cv.publicId || undefined,
        });
        clearDraft();
        await refresh();
        navigate("/volunteer/dashboard");
      } catch (err: any) {
        setError(err?.message ?? "Pendaftaran gagal. Silakan coba lagi.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={isPending} className="space-y-4 w-full border-none p-0 m-0">
            <div
              key={currentStep}
              className="animate-[fadeSlideIn_0.25s_ease-out_forwards]"
              style={{ animationFillMode: "both" }}
            >
              {currentStep === 0 && <Step1 isPending={isPending} />}
              {currentStep === 1 && (
                <Step2 isPending={isPending} uploads={uploads} setUploads={handleSetUploads} submitAttempted={submitAttempted} />
              )}
            </div>

            {error && (
              <Alert intent="error" className="mt-2 w-full">
                {error}
              </Alert>
            )}

            <StepNav
              currentStep={currentStep}
              totalSteps={STEPS.length}
              isPending={isPending}
              onNext={handleNext}
              onBack={handleBack}
            />
          </fieldset>
        </form>
      </FormProvider>

      <p className="text-center text-sm text-secondary">
        Sudah punya akun relawan?{" "}
        <Link to="/login" className="text-brand-primary hover:underline font-semibold">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
