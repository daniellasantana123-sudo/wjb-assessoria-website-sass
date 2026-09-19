import { logout } from "@/actions/auth";
import { buttonVariants } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Sair
      </button>
    </form>
  );
}
