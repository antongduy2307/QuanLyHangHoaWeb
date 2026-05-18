import { PageHeader } from "../../components/PageHeader";
import { PlaceholderPanel } from "../../components/PlaceholderPanel";

export function ReportsPlaceholder() {
  return (
    <>
      <PageHeader title="Bao cao" description="Bao cao la placeholder cho den khi API bao cao duoc thiet ke." />
      <PlaceholderPanel title="Chua trong pham vi" items={["Bao cao doanh thu", "Bao cao ton kho", "Bao cao cong no"]} />
    </>
  );
}
