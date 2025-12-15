// src/components/auth/LoginBackground.jsx
export default function LoginBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Gradient Orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute top-40 right-20 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-ping delay-1000"></div>
      <div className="absolute bottom-0 left-40 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse delay-500"></div>

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(#1e66f5 1px, transparent 1px), linear-gradient(90deg, #1e66f5 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
    </div>
  );
}