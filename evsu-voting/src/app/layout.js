import "./globals.css";

export const metadata = {
  title: "EVSU Voting System",
  description: "Official election platform for Eastern Visayas State University. Secure, professional, and trustworthy.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  );
}
