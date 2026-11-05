window.COVERAGE_DATA = {
 "_說明": "自動產生，請勿手動修改（改了會被覆蓋、也不會生效）。商品保障請寫在 coverage_manual.json 或 coverage.yaml。",
 "codes": [
  [
   "death_disease",
   "疾病身故",
   "身故"
  ],
  [
   "death_accident",
   "意外身故",
   "身故"
  ],
  [
   "death_cancer",
   "癌症身故",
   "身故"
  ],
  [
   "hosp_disease",
   "疾病住院",
   "住院"
  ],
  [
   "hosp_accident",
   "意外住院",
   "住院"
  ],
  [
   "hosp_cancer",
   "癌症住院",
   "住院"
  ],
  [
   "disability",
   "失能",
   "給付"
  ],
  [
   "surgery",
   "手術",
   "給付"
  ],
  [
   "outpatient",
   "門診",
   "給付"
  ],
  [
   "critical",
   "重大傷病／特定傷病",
   "給付"
  ],
  [
   "cancer_diag",
   "癌症診斷／治療",
   "給付"
  ],
  [
   "ltc",
   "長期照顧／失智",
   "給付"
  ],
  [
   "survival",
   "生存／祝壽／滿期",
   "給付"
  ],
  [
   "waiver",
   "豁免保費",
   "給付"
  ],
  [
   "other",
   "其他",
   "給付"
  ]
 ],
 "products": {
  "新e點愛小額終身壽險": {
   "name": "台灣人壽新e點愛小額終身壽險(115)【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "18足歲~72歲",
   "url": "/product/48/T04L3"
  },
  "e定保一年定期壽險": {
   "name": "台灣人壽e定保一年定期壽險(111)【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "18足歲~55歲",
   "url": "/product/48/YTL1"
  },
  "珍傳愛小額終身壽險": {
   "name": "台灣人壽珍傳愛小額終身壽險(115)",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~84歲",
   "url": "/product/48/T03K4"
  },
  "新健康龍101終身醫療健康保險": {
   "name": "台灣人壽新健康龍101終身醫療健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "燒燙傷病房保險金",
      "加護病房保險金",
      "住院日額保險金"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "手術醫療"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/4H5"
  },
  "新意享人生終身保險": {
   "name": "台灣人壽新意享人生終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "汽車、機車或自行車配戴安全設備身故金",
      "意外傷害身故金或喪葬費用",
      "假日意外傷害身故金或喪葬費用",
      "特定意外傷害身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "所繳保險費並加計利息的退還"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "假日意外傷害失能金",
      "汽車、機車或自行車配戴安全設備意外傷害失能金",
      "意外傷害失能金",
      "特定意外傷害失能金",
      "意外傷害失能扶助金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "滿期保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "16歲~60歲",
   "url": "/product/48/T07I1"
  },
  "金全愛守護防癌終身健康保險": {
   "name": "台灣人壽金全愛守護防癌終身健康保險【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "death_cancer",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "所繳保險費並加計利息的退還"
     ]
    },
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初期癌症金",
      "輕度癌症金",
      "重度癌症金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~50歲",
   "url": "/product/48/QCC1"
  },
  "與愛同行住院醫療終身健康保險": {
   "name": "台灣人壽與愛同行住院醫療終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金",
      "特別病房保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "住院前後門診醫療保險金",
      "門診手術醫療"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "住院手術醫療"
     ]
    }
   ],
   "age": "20歲~60歲",
   "url": "/product/48/T05C0"
  },
  "有愛無礙住院醫療終身健康保險": {
   "name": "台灣人壽有愛無礙住院醫療終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金",
      "特別病房保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "住院前後門診醫療保險金",
      "門診手術醫療"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "住院手術醫療"
     ]
    }
   ],
   "age": "20歲~60歲",
   "url": "/product/48/T05G0"
  },
  "新保安心住院醫療終身健康保險": {
   "name": "台灣人壽新保安心住院醫療終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "所繳保險費的退還"
     ]
    },
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金",
      "特別病房保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "住院前後門診醫療保險金"
     ]
    }
   ],
   "age": "      0歲~65歲",
   "url": "/product/48/T04Q3"
  },
  "新愛無憂85防癌定期健康保險": {
   "name": "台灣人壽新愛無憂85防癌定期健康保險",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "癌症骨髓移植金",
      "癌症照護金",
      "癌症標靶治療費用",
      "癌症義肢裝設金",
      "癌症義乳重建金",
      "癌症義齒裝設金",
      "放射線或化學治療"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "癌症門診手術醫療金",
      "癌症住院前後門診醫療金"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "癌症住院手術醫療金"
     ]
    },
    {
     "code": "hosp_cancer",
     "basis": "daily",
     "from": [
      "癌症住院日額保險金",
      "癌症長期住院病房金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/T06V2"
  },
  "珍愛守護防癌終身健康保險附約": {
   "name": "台灣人壽珍愛守護防癌終身健康保險附約",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初期癌症金",
      "輕度癌症金",
      "重度癌症金"
     ]
    }
   ],
   "age": "0歲~55歲",
   "url": "/product/48/T05K2"
  },
  "新平準型定期壽險附約": {
   "name": "台灣人壽新平準型定期壽險附約",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "15足歲~65歲",
   "url": "/product/48/T02J1"
  },
  "新愛肝人生終身保險(弱體型)": {
   "name": "台灣人壽新愛肝人生終身保險(弱體型)",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "肝病局部治療",
      "肝病重症提前給付",
      "肝病重症照顧分期",
      "肝病住院手術療養",
      "肝病住院手術",
      "肝病藥物治療給付",
      "健康回饋保險金",
      "弱體保單"
     ]
    },
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "15足歲~55歲",
   "url": "/product/48/T04H3"
  },
  "龍平安傷害保險附約": {
   "name": "台灣人壽龍平安傷害保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    }
   ],
   "age": "16歲~70歲",
   "url": "/product/48/AP0"
  },
  "安全保一年定期傷害保險附約": {
   "name": "台灣人壽安全保一年定期傷害保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "汽車、機車或自行車配戴安全設備身故金",
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "18足歲~70歲",
   "url": "/product/48/TADR"
  },
  "Fun心保傷害保險附約": {
   "name": "台灣人壽Fun心保傷害保險附約【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "汽車、機車或自行車配戴安全設備身故金",
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "18足歲~64歲",
   "url": "/product/48/TADR7"
  },
  "新彩意傷害保險附約": {
   "name": "台灣人壽新彩意傷害保險附約【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "20足歲~90歲",
   "url": "/product/48/ADD03"
  },
  "一年期特定傷病健康保險附約": {
   "name": "台灣人壽一年期特定傷病健康保險附約",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/YDB"
  },
  "新平安福海外突發疾病醫療健康保險附約": {
   "name": "台灣人壽新平安福海外突發疾病醫療健康保險附約",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "海外突發疾病醫療"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/930G"
  },
  "平安福旅行平安保險": {
   "name": "台灣人壽平安福旅行平安保險",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "reimb",
     "from": [
      "傷害醫療保險實支實付型"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "意外傷害失能金"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "0歲~90歲",
   "url": "/product/48/900"
  },
  "Fun心生活燒燙傷傷害保險附約": {
   "name": "台灣人壽Fun心生活燒燙傷傷害保險附約【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大燒燙傷保險金"
     ]
    }
   ],
   "age": "18足歲~64歲",
   "url": "/product/48/WMBR"
  },
  "Fun心生活骨折傷害保險附約": {
   "name": "台灣人壽Fun心生活骨折傷害保險附約【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "意外骨折保險金"
     ]
    }
   ],
   "age": "18足歲~65歲",
   "url": "/product/48/WBBR"
  },
  "唯e守護傷害保險": {
   "name": "台灣人壽唯e守護傷害保險【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "意外傷害失能金"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "18足歲~64歲",
   "url": "/product/48/WADD"
  },
  "Fun心生活特定意外身故傷害保險附約": {
   "name": "台灣人壽Fun心生活特定意外身故傷害保險附約【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "特定意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "18足歲~64歲",
   "url": "/product/48/WSADR"
  },
  "特定意外事故傷害保險附約": {
   "name": "台灣人壽特定意外事故傷害保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "特定意外傷害身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "特定意外傷害失能金"
     ]
    }
   ],
   "age": "16歲~65歲",
   "url": "/product/48/SADDR"
  },
  "新傷害醫療保險金日額附約": {
   "name": "台灣人壽新傷害醫療保險金日額附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "daily",
     "from": [
      "傷害醫療日額型"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/BJ0"
  },
  "新扶愛微型傷害保險": {
   "name": "台灣人壽新扶愛微型傷害保險",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "意外傷害失能金"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "0歲~85歲",
   "url": "/product/48/MIPA"
  },
  "一年期癌症健康保險附約": {
   "name": "台灣人壽一年期癌症健康保險附約",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "癌症骨髓移植金",
      "癌症義乳重建金",
      "放射線或化學治療"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "癌症門診手術醫療金",
      "癌症住院前後門診醫療金"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "癌症住院手術醫療金"
     ]
    },
    {
     "code": "hosp_cancer",
     "basis": "daily",
     "from": [
      "癌症住院日額保險金",
      "癌症長期住院病房金"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/YCA"
  },
  "新保富通定期壽險": {
   "name": "台灣人壽新保富通定期壽險【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "18足歲~64歲",
   "url": "/product/48/T07N1"
  },
  "保富通一年定期重大疾病健康保險(甲型)": {
   "name": "台灣人壽保富通一年定期重大疾病健康保險(甲型)【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大疾病保險金"
     ]
    }
   ],
   "age": "18足歲~64歲",
   "url": "/product/48/BODD"
  },
  "新保富通二十年定期重大疾病健康保險(甲型)": {
   "name": "台灣人壽新保富通二十年定期重大疾病健康保險(甲型)【限網路投保通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大疾病保險金"
     ]
    }
   ],
   "age": "18足歲~51歲",
   "url": "/product/48/T07P1"
  },
  "金卡安心一年定期重大傷病健康保險附約": {
   "name": "台灣人壽金卡安心一年定期重大傷病健康保險附約",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金",
      "重大傷病保險金"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/CIR4"
  },
  "金放心85長期照顧定期健康保險": {
   "name": "台灣人壽金放心85長期照顧定期健康保險",
   "source": "catalog",
   "kind": "ltc",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "所繳保險費的退還"
     ]
    },
    {
     "code": "ltc",
     "basis": "lump",
     "from": [
      "長期照顧分期金",
      "長期照顧一次金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "15足歲~70歲",
   "url": "/product/48/T08N0"
  },
  "守護85長期照顧定期健康保險": {
   "name": "台灣人壽守護85長期照顧定期健康保險",
   "source": "catalog",
   "kind": "ltc",
   "benefits": [
    {
     "code": "ltc",
     "basis": "lump",
     "from": [
      "長期照顧分期金",
      "長期照顧一次金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "15足歲~70歲",
   "url": "/product/48/T08P0"
  },
  "好扶氣一年定期重大傷害失能扶助保險給付附加條款": {
   "name": "台灣人壽好扶氣一年定期重大傷害失能扶助保險給付附加條款",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "失能復健金",
      "意外傷害第一級至第六級失能扶助金"
     ]
    }
   ],
   "age": "",
   "url": "/product/48/ADBE"
  },
  "珍多寶利率變動型增額終身壽險": {
   "name": "台灣人壽珍多寶利率變動型增額終身壽險【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "特定意外傷害身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "16歲~70歲",
   "url": "/product/48/T08S0"
  },
  "年年添利利率變動型還本終身保險": {
   "name": "台灣人壽年年添利利率變動型還本終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/T08Y0"
  },
  "全心全憶一年定期健康保險": {
   "name": "台灣人壽全心全憶一年定期健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "ltc",
     "basis": "lump",
     "from": [
      "認知功能障礙初期一次保險金",
      "認知功能障礙一次保險金",
      "認知功能障礙分期保險金"
     ]
    }
   ],
   "age": "30~65歲",
   "url": "/product/48/YMDL"
  },
  "憶心溢意一年定期健康保險": {
   "name": "台灣人壽憶心溢意一年定期健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "ltc",
     "basis": "lump",
     "from": [
      "認知功能障礙初期一次保險金",
      "認知功能障礙一次保險金",
      "認知功能障礙分期保險金"
     ]
    }
   ],
   "age": "30~65歲",
   "url": "/product/48/YDL"
  },
  "好滿溢一年定期癌症醫療健康保險附約": {
   "name": "台灣人壽好滿溢一年定期癌症醫療健康保險附約",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "hosp_cancer",
     "basis": "daily",
     "from": [
      "癌症住院日額保險金"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "癌症手術醫療保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "癌症門診醫療保險金"
     ]
    },
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "癌症身故保險金",
      "初次罹患癌症保險金"
     ]
    }
   ],
   "age": "0~75歲",
   "url": "/product/48/NYCC0803"
  },
  "好滿溢一年定期重大疾病健康保險附約(甲型)": {
   "name": "台灣人壽好滿溢一年定期重大疾病健康保險附約(甲型)",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大疾病保險金"
     ]
    }
   ],
   "age": "0~75歲",
   "url": "/product/48/NYCI0503"
  },
  "吉美富美元利率變動型終身壽險": {
   "name": "台灣人壽吉美富美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~85歲",
   "url": "/product/48/U09E0"
  },
  "百分百守護長期照顧終身健康保險": {
   "name": "台灣人壽百分百守護長期照顧終身健康保險",
   "source": "catalog",
   "kind": "ltc",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "健康步數折扣"
     ]
    },
    {
     "code": "ltc",
     "basis": "lump",
     "from": [
      "長期照顧分期金",
      "長期照顧一次金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金"
     ]
    }
   ],
   "age": "20足歲~70歲",
   "url": "/product/48/T09K0"
  },
  "超美利美元利率變動型終身壽險": {
   "name": "台灣人壽超美利美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/U09R0"
  },
  "鑫元氣重大疾病終身健康保險(乙型)": {
   "name": "台灣人壽鑫元氣重大疾病終身健康保險(乙型)",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大疾病保險金"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/T01N4"
  },
  "閣卡安心100重大傷病終身健康保險": {
   "name": "台灣人壽閣卡安心100重大傷病終身健康保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "無理賠回饋金"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金",
      "重大傷病保險金"
     ]
    }
   ],
   "age": "0歲~50歲",
   "url": "/product/48/NTCI0801"
  },
  "四海飛揚人民幣利率變動型終身壽險": {
   "name": "台灣人壽四海飛揚人民幣利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~87歲",
   "url": "/product/48/NRIW0101"
  },
  "超享利利率變動型還本終身保險": {
   "name": "台灣人壽超享利利率變動型還本終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "16歲~72歲",
   "url": "/product/48/NTIC0701"
  },
  "美鑫美利美元利率變動型終身壽險": {
   "name": "台灣人壽美鑫美利美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUIW6601"
  },
  "保利美美元利率變動型終身壽險": {
   "name": "台灣人壽保利美美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUIW6501"
  },
  "e樂活一年定期住院日額健康保險": {
   "name": "台灣人壽e樂活一年定期住院日額健康保險【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "燒燙傷病房保險金",
      "加護病房保險金",
      "住院日額保險金"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "住院手術醫療"
     ]
    }
   ],
   "age": "18足歲~55歲",
   "url": "/product/48/NTYH1801"
  },
  "龍好意日額型傷害醫療保險附約": {
   "name": "台灣人壽龍好意日額型傷害醫療保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "daily",
     "from": [
      "傷害醫療日額型"
     ]
    }
   ],
   "age": "0歲~75歲",
   "url": "/product/48/NYAH0401"
  },
  "智庫鑫美美元利率變動型終身保險": {
   "name": "台灣人壽智庫鑫美美元利率變動型終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0~65歲",
   "url": "/product/48/NUIW6801"
  },
  "全方位一年定期傷害保險附約": {
   "name": "台灣人壽全方位一年定期傷害保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "daily",
     "from": [
      "傷害醫療保險實支實付型",
      "傷害醫療日額型",
      "燒燙傷病房保險金",
      "加護病房保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "意外傷害失能金"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "意外傷害身故金或喪葬費用"
     ]
    }
   ],
   "age": "15足歲~70歲",
   "url": "/product/48/NTYA0901"
  },
  "龍實在住院醫療健康保險附約": {
   "name": "台灣人壽龍實在住院醫療健康保險附約",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金",
      "住院醫療費用保險金(實支實付)"
     ]
    },
    {
     "code": "outpatient",
     "basis": "reimb",
     "from": [
      "門診手術費用保險金(實支實付)",
      "住院前後門診保險金"
     ]
    },
    {
     "code": "surgery",
     "basis": "reimb",
     "from": [
      "特定處置費用保險金(實支實付)"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NTYH1901"
  },
  "澳利樂澳幣利率變動型養老保險": {
   "name": "台灣人壽澳利樂澳幣利率變動型養老保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "滿期保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~85歲",
   "url": "/product/48/NAIE0101"
  },
  "金美勝美元利率變動型終身壽險": {
   "name": "台灣人壽金美勝美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NUIW7201"
  },
  "美鑫富利美元利率變動型終身壽險": {
   "name": "台灣人壽美鑫富利美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUIW7002"
  },
  "臻美滿美元利率變動型終身壽險": {
   "name": "台灣人壽臻美滿美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~77歲",
   "url": "/product/48/NUIW7302"
  },
  "旺美勝美元利率變動型終身壽險": {
   "name": "台灣人壽旺美勝美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NUIW7101"
  },
  "金多利利率變動型增額終身壽險": {
   "name": "台灣人壽金多利利率變動型增額終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~85歲",
   "url": "/product/48/NTIW2102"
  },
  "金勝利利率變動型增額終身壽險": {
   "name": "台灣人壽金勝利利率變動型增額終身壽險【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~88歲",
   "url": "/product/48/NTIW2303"
  },
  "美年有鑫美元利率變動型還本終身保險": {
   "name": "台灣人壽美年有鑫美元利率變動型還本終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~78歲",
   "url": "/product/48/NUIC0901"
  },
  "意本正經實支實付型傷害醫療保險附約": {
   "name": "台灣人壽意本正經實支實付型傷害醫療保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "reimb",
     "from": [
      "傷害醫療保險實支實付型"
     ]
    }
   ],
   "age": "0歲~未滿15足歲",
   "url": "/product/48/NYAH0501"
  },
  "臻豐盛美元利率變動型終身壽險": {
   "name": "台灣人壽臻豐盛美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~77歲",
   "url": "/product/48/NUIW7501"
  },
  "安心醫療100終身健康保險": {
   "name": "台灣人壽安心醫療100終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "無理賠增額保險",
      "所繳保險費的退還"
     ]
    },
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "燒燙傷病房保險金",
      "住院照護保險金",
      "加護病房保險金",
      "住院日額保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "住院前後門診醫療保險金",
      "門診手術醫療"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "手術醫療",
      "住院手術醫療"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~68歲",
   "url": "/product/48/NTPH1901"
  },
  "美世多美元利率變動型終身壽險": {
   "name": "台灣人壽美世多美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~76歲",
   "url": "/product/48/NUIW7601"
  },
  "金多沛還本終身保險": {
   "name": "台灣人壽金多沛還本終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NTWC0201"
  },
  "金滿利利率變動型終身壽險": {
   "name": "台灣人壽金滿利利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NTIW2501"
  },
  "吉美世美元利率變動型終身壽險": {
   "name": "台灣人壽吉美世美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~88歲",
   "url": "/product/48/NUIW7701"
  },
  "心動溢生醫療定期健康保險": {
   "name": "台灣人壽心動溢生醫療定期健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "健康回饋保險金",
      "退還年繳應繳保險費總和"
     ]
    },
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "特定住院手術醫療保險金"
     ]
    }
   ],
   "age": "18足歲~65歲",
   "url": "/product/48/NTTH0101"
  },
  "多享利利率變動型還本終身保險": {
   "name": "台灣人壽多享利利率變動型還本終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~72歲",
   "url": "/product/48/NTIC0801"
  },
  "臻心美美元利率變動型終身壽險": {
   "name": "台灣人壽臻心美美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUIW7801"
  },
  "美溢發美元利率變動型終身壽險": {
   "name": "台灣人壽美溢發美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~72歲",
   "url": "/product/48/NUIW8001"
  },
  "美利富美元養老保險": {
   "name": "台灣人壽美利富美元養老保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "滿期保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~85歲",
   "url": "/product/48/NUEW0101"
  },
  "美紅旺美元分紅終身壽險": {
   "name": "台灣人壽美紅旺美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUPW0101"
  },
  "吉享紅分紅終身還本保險": {
   "name": "台灣人壽吉享紅分紅終身還本保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NTPC0101"
  },
  "吉美優美元利率變動型終身壽險": {
   "name": "台灣人壽吉美優美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~85歲",
   "url": "/product/48/NUIW7901"
  },
  "美鑫樂退美元利率變動型還本終身保險": {
   "name": "台灣人壽美鑫樂退美元利率變動型還本終身保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~76歲",
   "url": "/product/48/NUIC1101"
  },
  "金利樂利率變動型養老保險": {
   "name": "台灣人壽金利樂利率變動型養老保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "滿期保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NTIE0101"
  },
  "守愛溢生防癌定期健康保險": {
   "name": "台灣人壽守愛溢生防癌定期健康保險",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初期癌症金",
      "輕度癌症金",
      "重度癌症金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    }
   ],
   "age": "0歲~60歲",
   "url": "/product/48/NTCC1301"
  },
  "保重溢生重大傷病定期健康保險": {
   "name": "台灣人壽保重溢生重大傷病定期健康保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "other",
     "basis": "text",
     "from": [
      "無理賠回饋金"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金",
      "重大傷病保險金"
     ]
    }
   ],
   "age": "0歲~60歲",
   "url": "/product/48/NTCI1001"
  },
  "美鑫利旺美元利率變動型終身壽險": {
   "name": "台灣人壽美鑫利旺美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "18足歲~88歲",
   "url": "/product/48/NUIW8301"
  },
  "紅利旺分紅終身壽險": {
   "name": "台灣人壽紅利旺分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0~80歲",
   "url": "/product/48/NTPW0101"
  },
  "臻美福美元利率變動型終身壽險": {
   "name": "台灣人壽臻美福美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0~72歲",
   "url": "/product/48/NUIW8101"
  },
  "12強護溢生長期照顧定期健康保險": {
   "name": "台灣人壽12強護溢生長期照顧定期健康保險",
   "source": "catalog",
   "kind": "ltc",
   "benefits": [
    {
     "code": "ltc",
     "basis": "lump",
     "from": [
      "長期照顧分期金",
      "長期照顧一次金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "18足歲~70歲",
   "url": "/product/48/NTLC0701"
  },
  "吉安心定期壽險": {
   "name": "台灣人壽吉安心定期壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "15足歲~65歲",
   "url": "/product/48/NTTL1101"
  },
  "美利增鑫美元利率變動型終身壽險": {
   "name": "台灣人壽美利增鑫美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    }
   ],
   "age": "15足歲~88歲",
   "url": "/product/48/NUIW8401"
  },
  "加倍實在醫療95終身健康保險": {
   "name": "台灣人壽加倍實在醫療95終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "燒燙傷病房保險金",
      "加護病房保險金",
      "住院日額保險金",
      "住院醫療費用保險金(實支實付)"
     ]
    },
    {
     "code": "outpatient",
     "basis": "reimb",
     "from": [
      "住院前後門診醫療保險金",
      "門診手術醫療",
      "門診手術費用保險金(實支實付)"
     ]
    },
    {
     "code": "surgery",
     "basis": "reimb",
     "from": [
      "特定處置醫療",
      "特定處置費用保險金(實支實付)"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    }
   ],
   "age": "0歲~60歲",
   "url": "/product/48/NTPH2001"
  },
  "保實在住院醫療健康保險附約": {
   "name": "台灣人壽保實在住院醫療健康保險附約",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金",
      "住院醫療費用保險金(實支實付)"
     ]
    },
    {
     "code": "outpatient",
     "basis": "reimb",
     "from": [
      "門診手術費用保險金(實支實付)",
      "住院前後門診保險金"
     ]
    },
    {
     "code": "surgery",
     "basis": "reimb",
     "from": [
      "特定處置費用保險金(實支實付)"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/NTYH2101"
  },
  "美世長紅美元分紅終身壽險": {
   "name": "台灣人壽美世長紅美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~75歲",
   "url": "/product/48/NUPW0201"
  },
  "珍豐收美元分紅終身壽險": {
   "name": "台灣人壽珍豐收美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NUPW0501"
  },
  "美紅鑽美元分紅終身還本保險": {
   "name": "台灣人壽美紅鑽美元分紅終身還本保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金",
      "生存金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~78歲",
   "url": "/product/48/NUPC0101"
  },
  "美紅齊旺美元分紅終身壽險": {
   "name": "台灣人壽美紅齊旺美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~73歲",
   "url": "/product/48/NUPW0301"
  },
  "真滿溢一年定期日額型住院手術健康保險附約": {
   "name": "台灣人壽真滿溢一年定期日額型住院手術健康保險附約",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "住院日額保險金",
      "特別病房保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "住院前後門診醫療保險金",
      "門診手術醫療"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "住院手術醫療"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NTYH2002"
  },
  "愛滿溢一年定期癌症健康保險附約": {
   "name": "台灣人壽愛滿溢一年定期癌症健康保險附約",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初期癌症金",
      "輕度癌症金",
      "重度癌症金"
     ]
    }
   ],
   "age": "0歲~70歲。",
   "url": "/product/48/NYCC1002"
  },
  "臻威豐美元分紅終身壽險": {
   "name": "台灣人壽臻威豐美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUPW0601"
  },
  "美紅勝利美元分紅終身壽險": {
   "name": "台灣人壽美紅勝利美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NUPW0401"
  },
  "意生平安一年定期傷害暨兒童傷害失能保險附約": {
   "name": "台灣人壽意生平安一年定期傷害暨兒童傷害失能保險附約",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "意外傷害失能金",
      "意外傷害失能扶助金"
     ]
    },
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "意外傷害身故金或喪葬費用"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大燒燙傷保險金"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NTYA1001"
  },
  "意生平安日額型傷害醫療保險給付附加條款": {
   "name": "台灣人壽意生平安日額型傷害醫療保險給付附加條款",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "daily",
     "from": [
      "傷害醫療日額型",
      "燒燙傷病房保險金",
      "加護病房保險金"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NYAH0601"
  },
  "意生平安實支實付型傷害醫療保險給付附加條款": {
   "name": "台灣人壽意生平安實支實付型傷害醫療保險給付附加條款",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "reimb",
     "from": [
      "傷害醫療保險實支實付型"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NYAH0701"
  },
  "藥安心一年定期癌症精準醫療健康保險附約": {
   "name": "台灣人壽藥安心一年定期癌症精準醫療健康保險附約",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "罹癌後癌症基因檢測保險金",
      "罹癌後癌症標靶治療藥物保險金"
     ]
    }
   ],
   "age": "0歲~70歲",
   "url": "/product/48/NYCC0901"
  },
  "福氣成家定期壽險": {
   "name": "台灣人壽福氣成家定期壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "",
   "url": "/product/48/NTTL1201"
  },
  "多美富美元養老保險": {
   "name": "台灣人壽多美富美元養老保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "滿期保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~88歲",
   "url": "/product/48/NUEW0201"
  },
  "i安心終身傷害暨兒童傷害失能保險": {
   "name": "台灣人壽i安心終身傷害暨兒童傷害失能保險【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "accident",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用",
      "意外傷害身故金或喪葬費用",
      "特定意外傷害身故金或喪葬費用"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "假日意外傷害失能金",
      "意外傷害失能金",
      "特定意外傷害失能金",
      "意外傷害失能扶助金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "重大燒燙傷保險金"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/NTPA4001"
  },
  "美鑫永旺美元利率變動型終身壽險": {
   "name": "台灣人壽美鑫永旺美元利率變動型終身壽險【限本公司特定通路銷售】",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    }
   ],
   "age": "0歲~88歲",
   "url": "/product/48/NUIW8501"
  },
  "要保人豁免保險費一年定期健康保險附約": {
   "name": "台灣人壽要保人豁免保險費一年定期健康保險附約",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~75歲",
   "url": "/product/48/NTTW0901"
  },
  "要保人豁免保險費一年定期壽險附約": {
   "name": "台灣人壽要保人豁免保險費一年定期壽險附約",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "15足歲~75歲",
   "url": "/product/48/NTTW1001"
  },
  "美紅富利美元分紅終身壽險": {
   "name": "台灣人壽美紅富利美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    }
   ],
   "age": "0歲~88歲",
   "url": "/product/48/NUPW0701"
  },
  "鳳守愛防癌定期健康保險": {
   "name": "台灣人壽鳳守愛防癌定期健康保險",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    },
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初次罹患癌症(初期)或癌症(輕度)保險金",
      "初次罹患癌症(重度)保險金",
      "初次罹患特定部位癌症(重度)保險金(第二保單年度起適用)"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "特定手術醫療保險金",
      "特定手術療養保險金"
     ]
    }
   ],
   "age": "18足歲~60歲",
   "url": "/product/48/NTCC1401"
  },
  "美好60美元利率變動型終身壽險": {
   "name": "台灣人壽美好60美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~88歲",
   "url": "/product/48/NUIW8901"
  },
  "多美好美元養老保險": {
   "name": "台灣人壽多美好美元養老保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "滿期保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NUEW0301"
  },
  "超實在醫療99終身健康保險": {
   "name": "台灣人壽超實在醫療99終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "燒燙傷病房保險金",
      "加護病房保險金",
      "住院療養保險金",
      "日額型住院醫療保險金選擇給付",
      "住院日額保險金",
      "每日病房費用保險金（實支實付）",
      "住院醫療費用及手術費用保險金（實支實付）"
     ]
    },
    {
     "code": "outpatient",
     "basis": "reimb",
     "from": [
      "住院前後門診醫療保險金",
      "門診手術醫療",
      "門診手術費用保險金(實支實付)",
      "住院前後門診費用保險金（實支實付）"
     ]
    },
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初次罹患癌症保險金",
      "罹癌後癌症基因檢測保險金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "住院手術醫療保險金"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/NTPH2101"
  },
  "超順心手術醫療終身健康保險": {
   "name": "台灣人壽超順心手術醫療終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "意外創傷縫合處置醫療",
      "住院手術醫療",
      "特定處置保險金",
      "重大手術慰問保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "門診手術醫療"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/NTPS0301"
  },
  "美利33美元終身壽險": {
   "name": "台灣人壽美利33美元終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~77歲",
   "url": "/product/48/NUWL0301"
  },
  "龍守愛防癌定期健康保險": {
   "name": "台灣人壽龍守愛防癌定期健康保險",
   "source": "catalog",
   "kind": "cancer",
   "benefits": [
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    },
    {
     "code": "cancer_diag",
     "basis": "lump",
     "from": [
      "初次罹患癌症(初期)或癌症(輕度)保險金",
      "初次罹患癌症(重度)保險金",
      "初次罹患特定部位癌症(重度)保險金(第二保單年度起適用)"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "特定手術醫療保險金",
      "特定手術療養保險金"
     ]
    }
   ],
   "age": "18足歲~60歲",
   "url": "/product/48/NTCC1601"
  },
  "臻美傳愛美元利率變動型終身壽險": {
   "name": "台灣人壽臻美傳愛美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    }
   ],
   "age": "0歲~77歲",
   "url": "/product/48/NUIW9101"
  },
  "超寬心醫療99終身健康保險": {
   "name": "台灣人壽超寬心醫療99終身健康保險",
   "source": "catalog",
   "kind": "health",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "daily",
     "from": [
      "燒燙傷病房保險金",
      "加護病房保險金",
      "住院療養保險金",
      "住院日額保險金"
     ]
    },
    {
     "code": "outpatient",
     "basis": "text",
     "from": [
      "門診手術醫療"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "重大手術慰問保險金",
      "住院手術醫療保險金"
     ]
    }
   ],
   "age": "0歲~65歲",
   "url": "/product/48/NTPH2201"
  },
  "臻得美美元利率變動型終身壽險": {
   "name": "台灣人壽臻得美美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "lump",
     "from": [
      "增值回饋分享金",
      "生命末期提前給付保險金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    }
   ],
   "age": "0歲~74歲",
   "url": "/product/48/NUIW9201"
  },
  "美紅吉利美元分紅終身壽險": {
   "name": "台灣人壽美紅吉利美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    }
   ],
   "age": "18足歲~80歲",
   "url": "/product/48/NUPW0901"
  },
  "臻鑽盈盈變額萬能壽險": {
   "name": "台灣人壽臻鑽盈盈變額萬能壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "返還保單帳戶價值"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "16歲~85歲",
   "url": "/product/48/NITU2301"
  },
  "臻鑽盈盈外幣變額萬能壽險": {
   "name": "台灣人壽臻鑽盈盈外幣變額萬能壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "返還保單帳戶價值"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "16歲~85歲",
   "url": "/product/48/NIFU2301"
  },
  "新溢起健智特定傷病定期健康保險": {
   "name": "台灣人壽新溢起健智特定傷病定期健康保險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "waiver",
     "basis": "text",
     "from": [
      "豁免保費"
     ]
    },
    {
     "code": "critical",
     "basis": "lump",
     "from": [
      "特定傷病保險金"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "退還年繳應繳保險費總和"
     ]
    },
    {
     "code": "surgery",
     "basis": "text",
     "from": [
      "特定手術醫療保險金"
     ]
    }
   ],
   "age": "",
   "url": "/product/48/NTCI1201"
  },
  "旺美勝利美元利率變動型終身壽險": {
   "name": "台灣人壽旺美勝利美元利率變動型終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "other",
     "basis": "text",
     "from": [
      "增值回饋分享金"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "0歲~80歲",
   "url": "/product/48/NUIW9301"
  },
  "美盛長紅美元分紅終身壽險": {
   "name": "台灣人壽美盛長紅美元分紅終身壽險",
   "source": "catalog",
   "kind": "life",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "from": [
      "身故金或喪葬費用"
     ]
    },
    {
     "code": "survival",
     "basis": "text",
     "from": [
      "祝壽保險金"
     ]
    },
    {
     "code": "disability",
     "basis": "sum",
     "from": [
      "完全失能保險金"
     ]
    }
   ],
   "age": "",
   "url": "/product/48/NUPW1001"
  },
  "新安慶終身壽險": {
   "name": "新安慶終身壽險",
   "source": "manual",
   "basis_note": "條款第 X 條（版本日期）",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum",
     "pay": {
      "rate": 1,
      "note": "身故保險金＝保額",
      "conditions": [
       "依條款：被保險人身故且保單有效"
      ]
     }
    }
   ],
   "note": ""
  }
 },
 "rules": [
  {
   "pattern": "防癌|癌症",
   "label": "防癌",
   "benefits": [
    {
     "code": "hosp_cancer",
     "basis": "text"
    }
   ],
   "note": "只推論有癌症住院；手術、診斷金、身故等請依條款確認"
  },
  {
   "pattern": "傷害.*(醫療|限額|日額|實支)|傷害醫療",
   "label": "傷害醫療",
   "benefits": [
    {
     "code": "hosp_accident",
     "basis": "text"
    },
    {
     "code": "outpatient",
     "basis": "text"
    }
   ],
   "note": "意外住院／門診醫療；限額、日額或實支實付請依條款確認"
  },
  {
   "pattern": "傷害|意外",
   "label": "傷害",
   "benefits": [
    {
     "code": "death_accident",
     "basis": "sum"
    },
    {
     "code": "disability",
     "basis": "text"
    }
   ],
   "note": "意外身故（金額視為保額）與失能；失能比例請依條款確認"
  },
  {
   "pattern": "住院|醫療|健康",
   "label": "醫療",
   "benefits": [
    {
     "code": "hosp_all",
     "basis": "auto"
    }
   ],
   "note": "住院不分原因（疾病、意外、癌症皆給付）；手術、門診等其他給付請依條款確認"
  },
  {
   "pattern": "還本|養老|生存|祝壽",
   "label": "還本／養老",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum"
    },
    {
     "code": "survival",
     "basis": "text"
    }
   ],
   "note": "身故不分原因；生存金／祝壽金／滿期金金額依條款"
  },
  {
   "pattern": "壽險|終身|定期",
   "label": "壽險",
   "benefits": [
    {
     "code": "death_all",
     "basis": "sum"
    }
   ],
   "note": "身故不分原因"
  }
 ],
 "warnings": [],
 "counts": {
  "catalog": 125,
  "manual": 1,
  "json": 1,
  "yaml": 0
 }
};
