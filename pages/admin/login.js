// La connexion admin est fusionnée avec la connexion client — voir /login
// (pages/login.js). Cette page ne sert plus qu'à rediriger d'éventuels
// liens/marque-pages existants.
export default function AdminLoginRedirect() {
  return null;
}

export async function getServerSideProps() {
  return { redirect: { destination: '/login', permanent: false } };
}
