from pathlib import Path
from datetime import datetime
from typing import Optional
from xml.etree import ElementTree as ET
from zipfile import ZipFile


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def _column_to_index(ref: str) -> int:
    result = 0
    for char in ref:
        if char.isalpha():
            result = result * 26 + (ord(char.upper()) - 64)
    return max(result - 1, 0)


def _read_shared_strings(archive: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for item in root.findall("main:si", NS):
        text_parts = [node.text or "" for node in item.findall(".//main:t", NS)]
        values.append("".join(text_parts))
    return values


def _sheet_target(archive: ZipFile) -> Optional[str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.findall("main:sheets/main:sheet", NS)
    if not sheets:
        return None
    rel_id = sheets[0].attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    for rel in rels.findall("rel:Relationship", NS):
        if rel.attrib.get("Id") == rel_id:
            target = rel.attrib.get("Target", "")
            return f"xl/{target}" if not target.startswith("xl/") else target
    return None


def read_xlsx_rows(file_path: str) -> list[dict[str, str]]:
    path = Path(file_path)
    if not path.exists():
        return []

    with ZipFile(path) as archive:
        target = _sheet_target(archive)
        if not target or target not in archive.namelist():
            return []

        shared_strings = _read_shared_strings(archive)
        sheet = ET.fromstring(archive.read(target))
        rows: list[list[str]] = []
        for row in sheet.findall(".//main:sheetData/main:row", NS):
            values: list[str] = []
            cells = row.findall("main:c", NS)
            for cell in cells:
                ref = cell.attrib.get("r", "")
                index = _column_to_index(ref)
                while len(values) <= index:
                    values.append("")
                value_node = cell.find("main:v", NS)
                if value_node is None:
                    cell_value = ""
                else:
                    raw = value_node.text or ""
                    cell_type = cell.attrib.get("t")
                    if cell_type == "s":
                        try:
                            cell_value = shared_strings[int(raw)]
                        except Exception:
                            cell_value = raw
                    else:
                        cell_value = raw
                values[index] = cell_value
            rows.append(values)

    if not rows:
        return []

    headers = [str(item or "").strip() or f"列{index + 1}" for index, item in enumerate(rows[0])]
    result: list[dict[str, str]] = []
    for row in rows[1:]:
        padded = list(row) + [""] * max(len(headers) - len(row), 0)
        result.append({headers[index]: padded[index] if index < len(padded) else "" for index in range(len(headers))})
    return result


def _format_xls_value(value: object, cell_type: int, datemode: int) -> str:
    if value is None:
        return ""
    try:
        import xlrd

        if cell_type == xlrd.XL_CELL_DATE:
            dt = xlrd.xldate_as_datetime(value, datemode)
            if isinstance(dt, datetime):
                if dt.time().hour == 0 and dt.time().minute == 0 and dt.time().second == 0:
                    return dt.strftime("%Y-%m-%d")
                return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)
    return str(value or "").strip()


def read_xls_rows(file_path: str) -> list[dict[str, str]]:
    path = Path(file_path)
    if not path.exists():
        return []

    try:
        import xlrd
    except ImportError as exc:
        raise RuntimeError("读取 .xls 文件需要安装 xlrd>=2.0.1") from exc

    workbook = xlrd.open_workbook(str(path), on_demand=True)
    try:
        sheet = workbook.sheet_by_index(0)
        if sheet.nrows <= 0:
            return []

        headers = [
            _format_xls_value(sheet.cell_value(0, col), sheet.cell_type(0, col), workbook.datemode) or f"列{col + 1}"
            for col in range(sheet.ncols)
        ]
        rows: list[dict[str, str]] = []
        for row_index in range(1, sheet.nrows):
            item: dict[str, str] = {}
            has_value = False
            for col_index, header in enumerate(headers):
                value = _format_xls_value(
                    sheet.cell_value(row_index, col_index),
                    sheet.cell_type(row_index, col_index),
                    workbook.datemode,
                )
                if value:
                    has_value = True
                item[header] = value
            if has_value:
                rows.append(item)
        return rows
    finally:
        workbook.release_resources()
