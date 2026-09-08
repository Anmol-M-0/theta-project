import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { sessionStorage } from "../services/session.server";

export async function action({ request }: ActionFunctionArgs) {
  return redirect("/intake", {
    headers: {
      "Set-Cookie": sessionStorage.destroySession(),
    },
  });
}

export async function loader() {
  return redirect("/intake");
}
