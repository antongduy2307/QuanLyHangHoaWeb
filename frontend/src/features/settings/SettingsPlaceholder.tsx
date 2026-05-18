import { PageHeader } from "../../components/PageHeader";
import { PlaceholderPanel } from "../../components/PlaceholderPanel";

export function SettingsPlaceholder() {
  return (
    <>
      <PageHeader title="Cai dat" description="Khu vuc cai dat se duoc mo rong sau khi co user management va cau hinh he thong." />
      <PlaceholderPanel title="Chua trong pham vi" items={["Quan ly nguoi dung", "Cau hinh he thong", "Thong tin phien ban"]} />
    </>
  );
}
