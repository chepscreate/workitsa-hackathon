/**
 * Route template — remounts on every navigation, giving each page a soft
 * fade-in (`page-enter`, defined in globals.css; opacity-only so fixed
 * elements inside pages never re-anchor mid-animation).
 *
 * The flex classes keep the body's column layout intact: body is
 * `flex flex-col`, this wrapper is its single child, and pages rely on
 * `main.flex-1` pushing their footer down.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-col flex-1 min-w-0">{children}</div>;
}
