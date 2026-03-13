type ManagerName = "Andrew" | "Wesley" | "Eric" | "Greg" | string;

const MANAGER_STYLES: Record<string, string> = {
  Andrew: "bg-blue-100 text-blue-700 border-blue-300",
  Wesley: "bg-green-100 text-green-700 border-green-300",
  Eric: "bg-purple-100 text-purple-700 border-purple-300",
  Greg: "bg-orange-100 text-orange-700 border-orange-300",
};

export default function ManagerBadge({
  name,
  small = false,
}: {
  name: ManagerName;
  small?: boolean;
}) {
  const style =
    MANAGER_STYLES[name] ?? "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${
        small ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } ${style}`}
    >
      {name}
    </span>
  );
}