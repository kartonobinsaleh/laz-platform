import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { VolunteersRepository } from "./volunteers.repository";
import { AppError } from "../../common/errors/app.error";
import type {
  VolunteerLoginInput,
  VolunteerProfileInput,
  VolunteerRegistrationInput,
} from "../../../../shared/validations/volunteers.schema";
import type { VolunteerSessionUser } from "../../../../shared/types/volunteer";

@Injectable()
export class VolunteersService {
  constructor(private readonly volunteersRepository: VolunteersRepository) {}

  async register(input: VolunteerRegistrationInput): Promise<VolunteerSessionUser> {
    const existing = await this.volunteersRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError("EMAIL_TAKEN", "Email sudah terdaftar", 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const volunteer = await this.volunteersRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      phone: input.phone,
      addressDomicile: input.addressDomicile || null,
      addressKtp: input.addressKtp || null,
      photoUrl: input.photoUrl || null,
      photoPublicId: input.photoPublicId || null,
      ktpUrl: input.ktpUrl || null,
      ktpPublicId: input.ktpPublicId || null,
      cvUrl: input.cvUrl || null,
      cvPublicId: input.cvPublicId || null,
      status: "ACTIVE",
    });

    return { id: volunteer.id, name: volunteer.name, email: volunteer.email, phone: volunteer.phone, photoUrl: volunteer.photoUrl };
  }

  async signIn(credentials: VolunteerLoginInput): Promise<VolunteerSessionUser | null> {
    const volunteer = await this.volunteersRepository.findByEmail(credentials.email);
    if (!volunteer) return null;

    const isValid = await bcrypt.compare(credentials.password, volunteer.password);
    if (!isValid) return null;

    if (volunteer.status !== "ACTIVE") {
      throw new AppError("ACCOUNT_INACTIVE", "Akun relawan ini tidak aktif", 403);
    }

    return { id: volunteer.id, name: volunteer.name, email: volunteer.email, phone: volunteer.phone, photoUrl: volunteer.photoUrl };
  }

  async getById(id: string): Promise<VolunteerSessionUser | null> {
    const volunteer = await this.volunteersRepository.findById(id);
    if (!volunteer || volunteer.status !== "ACTIVE") return null;
    return { id: volunteer.id, name: volunteer.name, email: volunteer.email, phone: volunteer.phone, photoUrl: volunteer.photoUrl };
  }

  /** Profil lengkap (tanpa password) untuk halaman edit profil relawan. */
  async getFullProfile(id: string) {
    const volunteer = await this.volunteersRepository.findById(id);
    if (!volunteer) return null;
    const { password: _password, ...profile } = volunteer;
    return profile;
  }

  async updateProfile(id: string, input: VolunteerProfileInput): Promise<VolunteerSessionUser> {
    const volunteer = await this.volunteersRepository.update(id, {
      name: input.name,
      phone: input.phone,
      addressDomicile: input.addressDomicile || null,
      addressKtp: input.addressKtp || null,
      photoUrl: input.photoUrl || null,
      photoPublicId: input.photoPublicId || null,
      ktpUrl: input.ktpUrl || null,
      ktpPublicId: input.ktpPublicId || null,
      cvUrl: input.cvUrl || null,
      cvPublicId: input.cvPublicId || null,
    });
    return { id: volunteer.id, name: volunteer.name, email: volunteer.email, phone: volunteer.phone, photoUrl: volunteer.photoUrl };
  }
}
