import { type ContactStatus, statusLabels } from "@repo/contact-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statuses = ["new", "in_progress", "done", "spam"] as const;

export function ContactEditor({
  status,
  adminNote,
  name,
  received,
}: {
  status: ContactStatus;
  adminNote: string;
  name: string;
  received: string;
}) {
  const [nextStatus, setNextStatus] = useState<ContactStatus>(status);
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3.5">
      <Card>
        <CardHeader>対応状況</CardHeader>
        <CardContent>
          <form className="grid gap-3.5" method="post">
            <input name="intent" type="hidden" value="update" />
            <input name="status" type="hidden" value={nextStatus} />
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold" htmlFor="status-trigger">
                ステータス
              </label>
              <Select
                value={nextStatus}
                onValueChange={(value) => setNextStatus(value as ContactStatus)}
              >
                <SelectTrigger id="status-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabels[item]}（{item}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold" htmlFor="admin_note">
                管理メモ（お客様には見えません）
              </label>
              <Textarea
                id="admin_note"
                name="admin_note"
                defaultValue={adminNote}
                placeholder="例）11/10 午前に現地確認の電話をする"
              />
            </div>
            <Button type="submit">保存する</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-destructive">削除</CardHeader>
        <CardContent>
          <p className="m-0 mb-3 text-[13px] text-muted-foreground">
            削除は論理削除です。一覧から消えますが、データは残ります。
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive">
                この問い合わせを削除
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>この問い合わせを削除しますか？</DialogTitle>
              <DialogDescription>
                {name}（{received}{" "}
                受信）の問い合わせを削除します。論理削除のため、あとからデータベース上では残ります。
              </DialogDescription>
              <form className="flex justify-end gap-2" method="post">
                <input name="intent" type="hidden" value="delete" />
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button className="bg-destructive text-white hover:opacity-90" type="submit">
                  削除する
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
