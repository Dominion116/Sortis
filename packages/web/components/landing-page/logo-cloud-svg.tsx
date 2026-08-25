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
        <div className="logo-cloud-track my-12 sm:mt-8">
          {[false, true].map((duplicate) => (
            <div
              key={String(duplicate)}
              className="logo-cloud-group"
              aria-hidden={duplicate || undefined}
            >
              {dependencies.map((dependency) => (
                <a
                  key={dependency.name}
                  href={dependency.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={duplicate ? -1 : undefined}
                  className="flex h-15 w-32 shrink-0 items-center justify-center whitespace-nowrap text-center text-sm font-semibold tracking-tight text-primary transition-colors hover:text-brand"
                >
                  {dependency.name}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
