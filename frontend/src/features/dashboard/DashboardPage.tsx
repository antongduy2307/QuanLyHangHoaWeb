import { PageHeader } from "../../components/PageHeader";
import { PlaceholderPanel } from "../../components/PlaceholderPanel";

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Tong quan" description="Bang dieu khien tong hop se duoc ket noi voi API o cac dot sau." />
      <div className="content-grid">
        <PlaceholderPanel
          title="Trang thai hien tai"
          items={["Backend da co auth va API bao ve", "Frontend hien la shell dieu huong", "Chua co du lieu that"]}
        />
        <PlaceholderPanel
          title="Dot tiep theo"
          items={["Them dang nhap", "Them API client", "Ket noi danh sach hang hoa"]}
        />
      </div>
    </>
  );
}
