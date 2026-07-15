import { NextRequest, NextResponse } from "next/server";
import { getSession, verifyAdminPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
  }

  let valid: boolean;
  try {
    valid = await verifyAdminPassword(body.password);
  } catch (err) {
    console.error("[api/admin/login] config manquante:", err);
    return NextResponse.json(
      { error: "Configuration serveur incomplete. Voir GUIDE_DEMARRAGE.md." },
      { status: 500 }
    );
  }

  if (!valid) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const session = await getSession();
  session.isAdmin = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
