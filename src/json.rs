pub fn duckdb_value_to_json_value(dv: duckdb::types::Value) -> anyhow::Result<serde_json::Value> {
    let value = match dv {
        duckdb::types::Value::Null => serde_json::Value::Null,
        duckdb::types::Value::Boolean(b) => b.into(),
        duckdb::types::Value::TinyInt(i) => i.into(),
        duckdb::types::Value::SmallInt(i) => i.into(),
        duckdb::types::Value::USmallInt(i) => i.into(),
        duckdb::types::Value::Int(i) => i.into(),
        duckdb::types::Value::BigInt(i) => i.into(),
        duckdb::types::Value::UBigInt(i) => i.into(),
        duckdb::types::Value::Float(f) => match serde_json::Number::from_f64(f.into()) {
            Some(n) => serde_json::Value::Number(n),
            None => serde_json::Value::Null,
        },
        duckdb::types::Value::Double(f) => match serde_json::Number::from_f64(f) {
            Some(n) => serde_json::Value::Number(n),
            None => serde_json::Value::Null,
        },
        duckdb::types::Value::Text(s) => s.into(),
        duckdb::types::Value::Blob(b) => {
            let vec: Vec<serde_json::Value> = b
                .iter()
                .map(|&b| serde_json::Number::from(b).into())
                .collect();
            serde_json::Value::Array(vec)
        }
        duckdb::types::Value::Timestamp(_, _) => todo!(),
        duckdb::types::Value::Interval { .. } => todo!(),
        duckdb::types::Value::List(l) => serde_json::Value::Array(
            l.iter()
                .map(|b| duckdb_value_to_json_value(b.clone()))
                .collect::<anyhow::Result<Vec<_>>>()?,
        ),

        duckdb::types::Value::Array(l) => serde_json::Value::Array(
            l.iter()
                .map(|b| duckdb_value_to_json_value(b.clone()))
                .collect::<anyhow::Result<Vec<_>>>()?,
        ),
        duckdb::types::Value::Struct(s) => {
            let mut map = serde_json::Map::new();

            for (k, v) in s.iter() {
                map.insert(k.clone(), duckdb_value_to_json_value(v.clone())?);
            }

            map.into()
        }
        duckdb::types::Value::Union(u) => duckdb_value_to_json_value(*u)?,
        duckdb::types::Value::HugeInt(i) => i.to_string().into(),
        duckdb::types::Value::UTinyInt(i) => i.into(),
        duckdb::types::Value::UInt(i) => i.into(),
        duckdb::types::Value::Decimal(d) => d.to_string().into(),
        duckdb::types::Value::Date32(_) => todo!(),
        duckdb::types::Value::Time64(_, _) => todo!(),
        duckdb::types::Value::Enum(s) => s.into(),
        duckdb::types::Value::Map(s) => {
            let mut map = serde_json::Map::new();

            for (k, v) in s.iter() {
                let key_as_json_value = duckdb_value_to_json_value(k.clone())?;
                match key_as_json_value {
                    serde_json::Value::String(s) => {
                        map.insert(s, duckdb_value_to_json_value(v.clone())?);
                    }
                    serde_json::Value::Bool(b) => {
                        map.insert(b.to_string(), duckdb_value_to_json_value(v.clone())?);
                    }
                    serde_json::Value::Number(n) => {
                        map.insert(n.to_string(), duckdb_value_to_json_value(v.clone())?);
                    }
                    serde_json::Value::Null => {
                        map.insert(
                            serde_json::Value::Null.to_string(),
                            duckdb_value_to_json_value(v.clone())?,
                        );
                    }
                    _ => {
                        return Err(anyhow::anyhow!("Error converting a duckdb::Map to a serde_json::Value. Map key must be a scalar value, but got {:?}", key_as_json_value));
                    }
                }
            }

            map.into()
        }
    };

    Ok(value)
}

pub fn duckdb_row_to_json(row: &duckdb::Row) -> duckdb::Result<Vec<serde_json::Value>> {
    let column_count = row.as_ref().column_count();

    let mut vec: Vec<serde_json::Value> = Vec::with_capacity(column_count);

    for i in 0..column_count {
        let value: duckdb::types::Value = row.get(i)?;
        let json_value = duckdb_value_to_json_value(value).map_err(|err| {
            // Value.data_type is not yet implemented for all values:
            // https://github.com/duckdb/duckdb-rs/blob/36b83bcc912ec69583ea41280fcd585bdc3472e9/crates/duckdb/src/types/value.rs#L237
            // to prevent panics, hardcode a value type of duckdb::types::Type::Null
            duckdb::Error::FromSqlConversionFailure(i, duckdb::types::Type::Null, err.into())
        })?;

        vec.push(json_value);
    }

    Ok(vec)
}
