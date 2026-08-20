const dependencies = [
  { name: "Zama Protocol", href: "https://www.zama.org" },
  { name: "ERC-7984", href: "https://eips.ethereum.org/EIPS/eip-7984" },
  { name: "OpenZeppelin", href: "https://www.openzeppelin.com" },
  { name: "Ethereum Sepolia", href: "https://sepolia.etherscan.io" },
  { name: "Hardhat", href: "https://hardhat.org" },
  { name: "Next.js", href: "https://nextjs.org" },
];

export default function LogoCloud() {
  return (
    <div>
      <p className="mt-12 text-center text-xs font-bold uppercase tracking-[0.3em] text-primary">
        Powered by
      </p>
      <div className="logo-cloud-container">
        <div className="my-12 grid grid-cols-2 place-items-center justify-center gap-y-6 sm:mt-8 sm:grid-cols-3 sm:gap-10 md:mx-auto md:max-w-3xl md:grid-cols-6">
          {dependencies.map((dependency) => (
            <div
              key={dependency.name}
              className="flex h-15 w-28 items-center justify-center"
            >
              <a
                href={dependency.href}
                target="_blank"
                rel="noreferrer"
                className="text-center text-sm font-semibold tracking-tight text-primary transition-colors hover:text-brand"
              >
                {dependency.name}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
