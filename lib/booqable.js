/**
 * Client Booqable — API v4 (admin) + API v1 (fallback)
 *
 * Copié tel quel depuis portail-filme/lib/booqable.js (monespace.filme.fr)
 * pour réutiliser exactement la même logique de vérification client
 * (avec le double filtre v4 → v1 et la vérification stricte de l'email
 * retourné, indispensable car Booqable ignore parfois le filtre côté
 * serveur et retourne un client au hasard).
 *
 * Seule la partie utile à workshop.filme.fr est conservée :
 * getCustomerByEmail(). Le reste (commandes, documents, duplication...)
 * a été retiré pour garder ce fichier focalisé — recopiez le fichier
 * source si vous avez besoin des autres fonctions ici aussi.
 */

const SLUG    = process.env.BOOQABLE_COMPANY_SLUG; // ex: filme
const API_KEY = process.env.BOOQABLE_API_KEY;
const BASE_V4 = () => `https://${SLUG}.booqable.com/api/4`;
const BASE_V1 = () => `https://${SLUG}.booqable.com/api/boomerang`;

// ─── Requête générique v4 ────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch(`${BASE_V4()}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...opts.headers,
    },
  });

  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json.errors?.[0]?.detail || json.error || `Booqable API ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return json;
}

// ─── Requête générique v1 ────────────────────────────────────────────────────

async function apiV1(path, opts = {}) {
  const url = `${BASE_V1()}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
      ...opts.headers,
    },
  });

  if (res.status === 204) return null;
  const text = await res.text();
  console.log(`[v1] ${res.status} ${url} → ${text.slice(0, 300)}`);

  if (!res.ok) {
    const err = new Error(`v1 ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return JSON.parse(text);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getCustomerByEmail(email) {
  const normalized = email.trim().toLowerCase();

  // Tentative v4
  try {
    const data = await api(
      `/customers?filter[email]=${encodeURIComponent(email)}&page[size]=1`
    );
    if (data?.data?.length) {
      const c = data.data[0];
      const returnedEmail = c.attributes.email || '';
      // Vérification stricte : le filtre Booqable peut être ignoré et retourner n'importe quel client
      if (returnedEmail.toLowerCase() !== normalized) {
        console.log('[booqable] v4 email mismatch:', returnedEmail, '≠', normalized);
      } else {
        return { id: c.id, email: c.attributes.email, name: c.attributes.name || email };
      }
    }
    console.log('[booqable] v4 customers: aucun résultat');
  } catch (e) {
    console.log('[booqable] v4 customers error:', e.message);
  }

  // Fallback v1 — plusieurs variantes de filtre
  const filtersToTry = [
    `/customers?filter[email][eq]=${encodeURIComponent(email)}&page[size]=1`,
    `/customers?filter[email]=${encodeURIComponent(email)}&page[size]=1`,
    `/customers?q[email_eq]=${encodeURIComponent(email)}&per=1`,
  ];

  for (const path of filtersToTry) {
    try {
      const data = await apiV1(path);
      console.log('[booqable] v1 raw keys:', Object.keys(data || {}));

      // Booqable v1 peut retourner { customers: [...] } ou { data: [...] }
      const customers =
        data?.customers ||
        data?.data ||
        (Array.isArray(data) ? data : []);

      console.log('[booqable] v1 customers count:', customers.length, 'path:', path);

      if (customers.length) {
        const c = customers[0];
        const returnedEmail = c.email || c.attributes?.email || '';
        // Vérification stricte
        if (returnedEmail.toLowerCase() !== normalized) {
          console.log('[booqable] v1 email mismatch:', returnedEmail, '≠', normalized);
          continue;
        }
        return {
          id:    c.id || c.uuid,
          email: returnedEmail,
          name:  c.name || c.attributes?.name || email,
        };
      }
    } catch (e) {
      console.log('[booqable] v1 error for', path, ':', e.message);
    }
  }

  console.log('[booqable] customer not found for email:', email);
  return null;
}

// ─── Profil client complet (lecture + mise à jour) ───────────────────────────
// Utilisé par la popup "Mon profil" (cf. components/UserBar.js). Le customer
// id Booqable n'est jamais stocké dans le cookie de session (cf. lib/auth.js)
// — l'appelant doit d'abord passer par getCustomerByEmail() (avec sa
// vérification stricte de l'email) pour l'obtenir.

export async function getCustomerProfile(customerId) {
  const data = await api(`/customers/${customerId}`);
  const a = data?.data?.attributes || {};
  return {
    id: data?.data?.id || customerId,
    name: a.name || '',
    email: a.email || '',
    phone: a.phone || '',
    legalType: a.legal_type || 'person',
    address: a.properties?.main_address || null,
    discountPct: a.discount_percentage || 0,
    orderCount: a.order_count || 0,
    balanceDue: (a.balance_due_in_cents || 0) / 100,
  };
}

// Mise à jour partielle (merge) — seuls les champs présents dans `fields`
// (name/phone/properties, cf. booqable-client-rw.docx) sont modifiés ; les
// autres custom properties déjà en base sont conservées par Booqable. Relit
// le profil complet après écriture plutôt que de remapper la réponse PATCH,
// pour garantir la même forme que getCustomerProfile().
export async function updateCustomer(customerId, fields) {
  await api(`/customers/${customerId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'customers',
        id: customerId,
        attributes: fields,
      },
    }),
  });
  return getCustomerProfile(customerId);
}
