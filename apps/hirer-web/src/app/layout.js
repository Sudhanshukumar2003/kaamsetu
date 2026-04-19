import './globals.css';

export const metadata = {
  title: 'KaamSetu — Hire Verified Blue-Collar Workers',
  description: 'Find verified, rated blue-collar workers near you. Secure escrow payments. No middlemen.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
