import { ProfileForm } from "@/components/dashboard/profile-form";
import { getMarketingConsent, getUserProfile } from "@/server/account";
import { requireSession } from "@/server/session";

export const metadata = { title: "Perfil · Configurações" };

export default async function PerfilPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, marketingOptIn] = await Promise.all([
    getUserProfile(userId),
    getMarketingConsent(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ProfileForm
        name={session.user.name ?? ""}
        email={session.user.email}
        emailVerified={session.user.emailVerified}
        personType={profile?.personType ?? null}
        document={profile?.document ?? null}
        marketingOptIn={marketingOptIn}
        profile={
          profile
            ? {
                phone: profile.phone,
                zip: profile.zip,
                street: profile.street,
                number: profile.number,
                complement: profile.complement ?? "",
                district: profile.district,
                city: profile.city,
                state: profile.state,
              }
            : null
        }
      />
    </div>
  );
}
