import { NextRequest, NextResponse } from "next/server";
import { sealData, unsealData } from "iron-session";
import { sessionOptions, SESSION_TTL_SECONDS, type SessionData } from "@/lib/auth";

// Protege toutes les routes /admin/* (sauf la page de login elle-meme).
// On decode le cookie de session directement ici (compatible edge runtime)
// plutot que de reutiliser getSession(), qui depend de next/headers cote
// route handler.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isAdminArea = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";

  if (!isAdminArea && !isAdminApi) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(sessionOptions.cookieName)?.value;
  let isAdmin = false;

  if (cookie && sessionOptions.password) {
    try {
      const data = await unsealData<SessionData>(cookie, { password: sessionOptions.password });
      isAdmin = data.isAdmin === true;
    } catch {
      isAdmin = false;
    }
  }

  if (isAdmin) {
    // Déjà connecté : la page de login renvoie directement au tableau de bord.
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    const response = NextResponse.next();
    // Session glissante : à chaque ouverture d'une page producteur, on
    // repart pour 1 an, pour ne jamais avoir à retaper le mot de passe.
    if (isAdminArea) {
      const sealed = await sealData({ isAdmin: true } satisfies SessionData, {
        password: sessionOptions.password,
        ttl: SESSION_TTL_SECONDS,
      });
      response.cookies.set(sessionOptions.cookieName, sealed, {
        httpOnly: true,
        path: "/",
        ...sessionOptions.cookieOptions,
      });
    }
    return response;
  }

  if (isAdminApi) {
    return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
  }

  if (isLoginPage) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
