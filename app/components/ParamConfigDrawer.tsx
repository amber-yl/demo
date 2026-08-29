"use client";

import { RotateCcw, Save } from "lucide-react";
import { Drawer } from "antd";
import { DrawerSchemaForm } from "@/components/SchemaFormFields";
import type { FieldErrors } from "@/components/SchemaFormFields";
import type { ConfigSchema } from "@/utils/api";
import styles from "./ParamConfigDrawer.module.less";

/**
 * 参数配置抽屉：模型/芯片共用，仅参数不同。
 * 选中卡片后从右侧展示对应 Schema 参数表单，底部带「保存模板 / 重置」操作。
 */
export default function ParamConfigDrawer({
  open,
  onClose,
  title,
  schema,
  values,
  errors,
  onChange,
  onSave,
  onReset,
  prefix,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  schema: ConfigSchema | null;
  values: Record<string, unknown>;
  errors: FieldErrors;
  onChange: (path: string, value: unknown) => void;
  onSave: () => void;
  onReset: () => void;
  prefix: string;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      placement="right"
      width="clamp(380px, 26vw, 700px)"
      footer={
        <div className={styles.drawerFooter}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} flex-1`}
            onClick={onSave}
          >
            <Save size={15} />
            <span>保存模板</span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} flex-1`}
            onClick={onReset}
          >
            <RotateCcw size={15} />
            <span>重置</span>
          </button>
        </div>
      }
    >
      <DrawerSchemaForm
        schema={schema}
        values={values}
        errors={errors}
        onChange={onChange}
        prefix={prefix}
      />
    </Drawer>
  );
}
