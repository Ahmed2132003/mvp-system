import logo from '../../assets/logo.svg';

const variantConfig = {
  desktop: {
    titleClass: 'text-xl font-bold text-primary dark:text-blue-300',
    subtitleClass: 'text-xs text-gray-500 mt-1 dark:text-gray-400',
    logoClass: 'h-11 w-11',
    defaultTag: 'h1',
  },
  mobile: {
    titleClass: 'text-base font-bold text-primary dark:text-blue-300',
    subtitleClass: 'text-[11px] text-gray-500 mt-0.5 dark:text-gray-400',
    logoClass: 'h-9 w-9',
    defaultTag: 'h2',
  },
  auth: {
    titleClass: 'text-4xl font-bold text-primary',
    subtitleClass: 'text-lg text-text-secondary mt-2',
    logoClass: 'h-14 w-14',
    defaultTag: 'h1',
  },
};

export default function BrandMark({
  subtitle,
  variant = 'desktop',
  titleTag,
  className = '',
  titleClassName = '',
  subtitleClassName = '',
  logoClassName = '',
}) {
  const config = variantConfig[variant] ?? variantConfig.desktop;
  const TitleTag = titleTag || config.defaultTag;
  const logoClasses = `${config.logoClass} rounded-xl shadow-sm ring-1 ring-primary/20 bg-white object-contain ${logoClassName}`;
  const titleClasses = `${config.titleClass} leading-tight ${titleClassName}`;
  const subtitleClasses = `${config.subtitleClass} leading-tight ${subtitleClassName}`;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src={logo} alt="NIBAR Cloud System logo" className={logoClasses} />
      <div className="leading-tight">
        <TitleTag className={titleClasses}>NIBAR Cloud System</TitleTag>
        {subtitle ? <p className={subtitleClasses}>{subtitle}</p> : null}
      </div>
    </div>
  );
}